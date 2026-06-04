/**
 * Assign houses to students who have started payments, then email them their
 * house assignment using the template from email_outputs_balanced.json
 * (ported into src/constants/houses.ts).
 *
 * "Started payments" = paymentStatus is PARTIALLY_PAID or FULLY_PAID.
 * Students who already have a house keep it; students without one are assigned
 * to the least-populated house to keep the houses balanced.
 *
 * The script is idempotent: a student who already received the email is skipped
 * unless --resend is passed.
 *
 * Usage:
 *   npm run houses:mail                 # assign + email
 *   npm run houses:mail -- --dry        # preview, no writes, no email
 *   npm run houses:mail -- --fully-paid # restrict to FULLY_PAID students
 *   npm run houses:mail -- --resend     # re-send even if already emailed
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student, { IStudent } from "../src/models/Student";
import { PaymentStatus } from "../src/types";
import {
  HOUSES,
  HOUSE_NAMES,
  HouseName,
} from "../src/constants/houses";
import mailService from "../src/services/mail.service";
import logger from "../src/utils/logger";

const dryRun = process.argv.includes("--dry");
const resend = process.argv.includes("--resend");
const fullyPaidOnly = process.argv.includes("--fully-paid");

/** Build current per-house counts so new assignments stay balanced. */
async function loadHouseCounts(): Promise<Record<HouseName, number>> {
  const counts = Object.fromEntries(
    HOUSE_NAMES.map((h) => [h, 0]),
  ) as Record<HouseName, number>;

  const grouped = await Student.aggregate<{ _id: HouseName; n: number }>([
    { $match: { house: { $in: HOUSE_NAMES } } },
    { $group: { _id: "$house", n: { $sum: 1 } } },
  ]);
  for (const g of grouped) {
    if (g._id in counts) counts[g._id] = g.n;
  }
  return counts;
}

/** Pick the house with the fewest members (ties broken by HOUSE_NAMES order). */
function leastPopulatedHouse(counts: Record<HouseName, number>): HouseName {
  return HOUSE_NAMES.reduce((best, h) =>
    counts[h] < counts[best] ? h : best,
  );
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  const statuses = fullyPaidOnly
    ? [PaymentStatus.FULLY_PAID]
    : [PaymentStatus.PARTIALLY_PAID, PaymentStatus.FULLY_PAID];

  const students: IStudent[] = await Student.find({
    paymentStatus: { $in: statuses },
    email: { $exists: true, $nin: [null, ""] },
  });

  logger.info(
    `Found ${students.length} student(s) who have started payments` +
      `${fullyPaidOnly ? " (fully paid only)" : ""}.`,
  );

  const counts = await loadHouseCounts();

  let assigned = 0; // newly given a house
  let emailed = 0;
  let skipped = 0; // already emailed
  const failures: string[] = [];

  for (const student of students) {
    // 1. Ensure the student has a house (assign balanced if not).
    let house = student.house as HouseName | undefined;
    let newlyAssigned = false;

    if (!house) {
      house = leastPopulatedHouse(counts);
      newlyAssigned = true;
      if (!dryRun) {
        student.house = house;
        student.houseWhatsappLink = HOUSES[house].whatsappLink;
        await student.save();
      }
      counts[house]++; // keep balance for subsequent assignments
      assigned++;
      logger.info(
        `${dryRun ? "[dry] " : ""}Assigned ${student.fullName} -> ${house} House`,
      );
    }

    // 2. Skip if already emailed (unless --resend).
    if (student.houseAssignmentEmailSentAt && !resend) {
      skipped++;
      continue;
    }

    // 3. Send the house assignment email.
    if (dryRun) {
      logger.info(
        `[dry] Would email ${student.email} -> ${house} House` +
          `${newlyAssigned ? " (new)" : ""}`,
      );
      emailed++;
      continue;
    }

    try {
      await mailService.sendHouseAssignmentEmail(
        student.email as string,
        student.fullName,
        student.gender,
        house,
      );
      student.houseAssignmentEmailSentAt = new Date();
      await student.save();
      emailed++;
    } catch (err) {
      failures.push(`${student.email} (${(err as Error).message})`);
      logger.error(`Failed to email ${student.email}:`, err);
    }
  }

  logger.info("──────────────────────────────────────────────");
  logger.info(`${dryRun ? "[DRY RUN] " : ""}House mailing complete`);
  logger.info(`  Newly assigned a house: ${assigned}`);
  logger.info(`  Emailed:                ${emailed}`);
  logger.info(`  Skipped (already sent): ${skipped}`);
  logger.info(`  Failed:                 ${failures.length}`);
  if (failures.length) {
    failures.forEach((f) => logger.warn(`  - ${f}`));
  }
  logger.info(
    `  Final house counts: ${HOUSE_NAMES.map((h) => `${h}=${counts[h]}`).join(", ")}`,
  );

  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (err) => {
  logger.error("❌ Failed to assign houses and mail:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
