/**
 * Assign a single student (matric 190407059, Ahamisi Godsfavour) to the White
 * House and email them their house assignment using the standard template
 * (src/constants/houses.ts).
 *
 * This is a one-off, targeted assignment — it ignores the gender-balancing
 * logic of `assign-houses-and-mail.ts` and simply forces the White House.
 *
 * Safety: this script WRITES to the DB and SENDS email. It is opt-in — without
 * `--send` it runs as a DRY RUN and only prints what it would do. Re-running
 * with --send is safe: it just re-sets the house and re-sends the email.
 *
 * Usage:
 *   ts-node scripts/assign-white-house.ts            # DRY RUN (default)
 *   ts-node scripts/assign-white-house.ts --send     # assign White House + email
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student from "../src/models/Student";
import { HOUSES, HouseName } from "../src/constants/houses";
import mailService from "../src/services/mail.service";
import logger from "../src/utils/logger";

// Sending is opt-in. Without --send (or --live) nothing is written or emailed.
const live =
  process.argv.includes("--send") || process.argv.includes("--live");
const dryRun = !live;

const MATRIC_NUMBER = "190407059";
const HOUSE: HouseName = "White";

async function run(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  if (dryRun) {
    logger.warn("🚧 DRY RUN — no DB writes, no email. Pass --send to apply.");
  }

  const matricNumber = MATRIC_NUMBER.toUpperCase();
  const student = await Student.findOne({ matricNumber });

  if (!student) {
    throw new Error(
      `No student found for matric ${matricNumber}. Run the onboarding script first.`,
    );
  }

  if (!student.email) {
    throw new Error(`Student ${matricNumber} has no email address on file.`);
  }

  logger.info(
    `👤 ${student.fullName} (${matricNumber}, ${student.gender}) | ${student.email}`,
  );
  logger.info(`🏠 Assigning to ${HOUSE} House`);

  if (dryRun) {
    logger.info(
      `Would: set house=${HOUSE}, set WhatsApp link, and email the assignment.`,
    );
    logger.info("🎉 Dry run complete.");
    return;
  }

  // Assign the White House and its WhatsApp group link.
  student.house = HOUSE;
  student.houseWhatsappLink = HOUSES[HOUSE].whatsappLink;
  await student.save();
  logger.info(`✓ House set to ${HOUSE} for ${student.fullName}`);

  // Email the house assignment.
  await mailService.sendHouseAssignmentEmail(
    student.email,
    student.fullName,
    student.gender,
    HOUSE,
  );
  student.houseAssignmentEmailSentAt = new Date();
  await student.save();
  logger.info(`✓ House assignment emailed to ${student.email}`);

  logger.info("🎉 Done.");
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error("❌ Failed to assign White House:", error);
    await mongoose.disconnect();
    process.exit(1);
  });
