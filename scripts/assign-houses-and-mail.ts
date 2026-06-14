/**
 * Assign houses to students who have started payments, then email them their
 * house assignment using the template from email_outputs_balanced.json
 * (ported into src/constants/houses.ts).
 *
 * "Started payments" = paymentStatus is PARTIALLY_PAID or FULLY_PAID.
 * Students who already have a house are skipped entirely; only those without
 * one are assigned and emailed.
 *
 * Balancing is gender-aware: we first count the existing male and female
 * members already in each house, then assign each unassigned student to the
 * house that currently has the fewest members of THAT student's gender. This
 * keeps the male/female split even across houses (e.g. ~30 boys + ~20 girls
 * per house) rather than just balancing the raw head-count.
 *
 * The script is idempotent: a student who already received the email is skipped
 * unless --resend is passed.
 *
 * Usage:
 *   npm run houses:mail                  # DRY RUN (default) — no email, no writes
 *   npm run houses:mail -- --send        # actually assign + email
 *   npm run houses:mail -- --send --fully-paid  # restrict to FULLY_PAID students
 *   npm run houses:mail -- --send --resend      # re-send even if already emailed
 *
 * Sending is opt-in: you MUST pass --send (after `--`). Anything else is a dry run.
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student, { IStudent } from "../src/models/Student";
import { PaymentStatus } from "../src/types";
import { HOUSES, HOUSE_NAMES, HouseName } from "../src/constants/houses";
import mailService from "../src/services/mail.service";
import logger from "../src/utils/logger";

// SAFETY: sending is opt-in. Without an explicit --send (or --live) flag this
// script ALWAYS runs as a dry run — it never sends email or writes to the DB.
// This guards against npm swallowing flags: `npm run houses:mail --dry` does
// NOT pass --dry to the script, but the default-dry behaviour keeps it safe.
// To actually send:  npm run houses:mail -- --send
const live = process.argv.includes("--send") || process.argv.includes("--live");
const dryRun = !live;
const resend = process.argv.includes("--resend");
const fullyPaidOnly = process.argv.includes("--fully-paid");

type Gender = "male" | "female";

/** Per-house member counts, split by gender. */
type HouseGenderCounts = Record<HouseName, Record<Gender, number>>;

/**
 * Build current per-house counts split by gender so new assignments keep the
 * male/female distribution even across houses.
 */
async function loadHouseCounts(): Promise<HouseGenderCounts> {
  const counts = Object.fromEntries(
    HOUSE_NAMES.map((h) => [h, { male: 0, female: 0 }]),
  ) as HouseGenderCounts;

  const grouped = await Student.aggregate<{
    _id: { house: HouseName; gender: Gender };
    n: number;
  }>([
    { $match: { house: { $in: HOUSE_NAMES }, gender: { $in: ["male", "female"] } } },
    {
      $group: {
        _id: { house: "$house", gender: "$gender" },
        n: { $sum: 1 },
      },
    },
  ]);
  for (const g of grouped) {
    const { house, gender } = g._id;
    if (house in counts && (gender === "male" || gender === "female")) {
      counts[house][gender] = g.n;
    }
  }
  return counts;
}

/**
 * Pick the house with the fewest members of the given gender so each gender is
 * spread evenly (ties broken by HOUSE_NAMES order).
 */
function leastPopulatedHouse(
  counts: HouseGenderCounts,
  gender: Gender,
): HouseName {
  return HOUSE_NAMES.reduce((best, h) =>
    counts[h][gender] < counts[best][gender] ? h : best,
  );
}

async function run() {
  if (dryRun) {
    logger.info(
      "🧪 DRY RUN — no emails will be sent and nothing will be written. Pass `-- --send` to go live.",
    );
  } else {
    logger.warn(
      "🚨 LIVE MODE — real emails will be sent and the database will be updated.",
    );
  }

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
  logger.info(
    `Existing house distribution: ${HOUSE_NAMES.map(
      (h) =>
        `${h}=${counts[h].male + counts[h].female} (M:${counts[h].male} F:${counts[h].female})`,
    ).join(", ")}`,
  );

  let assigned = 0; // newly given a house
  let emailed = 0;
  let skippedHasHouse = 0; // already had a house -> left untouched
  let skipped = 0; // already emailed
  const failures: string[] = [];

  for (const student of students) {
    // Skip anyone who already has a house — only newly assign + email those
    // without one.
    if (student.house) {
      skippedHasHouse++;
      continue;
    }

    // 1. Assign a house that keeps this student's gender balanced across houses.
    const gender: Gender = student.gender === "female" ? "female" : "male";
    const house = leastPopulatedHouse(counts, gender);
    if (!dryRun) {
      student.house = house;
      student.houseWhatsappLink = HOUSES[house].whatsappLink;
      await student.save();
    }
    counts[house][gender]++; // keep balance for subsequent assignments
    assigned++;
    logger.info(
      `${dryRun ? "[dry] " : ""}Assigned ${student.fullName} (${gender}) -> ${house} House`,
    );

    // 2. Skip emailing if already emailed (unless --resend).
    if (student.houseAssignmentEmailSentAt && !resend) {
      skipped++;
      continue;
    }

    // 3. Send the house assignment email.
    if (dryRun) {
      logger.info(`[dry] Would email ${student.email} -> ${house} House`);
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
  logger.info(`  Skipped (already had house): ${skippedHasHouse}`);
  logger.info(`  Skipped (already emailed):   ${skipped}`);
  logger.info(`  Failed:                 ${failures.length}`);
  if (failures.length) {
    failures.forEach((f) => logger.warn(`  - ${f}`));
  }
  logger.info(
    `  Final house counts: ${HOUSE_NAMES.map(
      (h) =>
        `${h}=${counts[h].male + counts[h].female} (M:${counts[h].male} F:${counts[h].female})`,
    ).join(", ")}`,
  );

  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (err) => {
  logger.error("❌ Failed to assign houses and mail:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
