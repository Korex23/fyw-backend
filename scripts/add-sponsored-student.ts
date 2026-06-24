/**
 * Add a single fully-sponsored student on the Full Experience package, generate
 * their invite and email it to them.
 *
 * The student is created with paymentStatus = SPONSORSHIP: they pay nothing
 * (totalPaid stays 0) but receive full access and an invite, just like a
 * FULLY_PAID student. The Full Experience package includes every event day, so
 * no day selection is required.
 *
 * Safety: this script WRITES to the DB, uploads to Cloudinary and SENDS email.
 * It is opt-in — without `--send` it runs as a DRY RUN and only prints what it
 * would do. Re-running with --send is safe: the student is upserted by matric
 * number and the invite is regenerated/re-sent.
 *
 * Usage:
 *   ts-node scripts/add-sponsored-student.ts            # DRY RUN (default)
 *   ts-node scripts/add-sponsored-student.ts --send     # create + invite + email
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student from "../src/models/Student";
import { IPackage } from "../src/models/Package";
import { PaymentStatus } from "../src/types";
import packageService from "../src/services/package.service";
import inviteService from "../src/services/invite.service";
import mailService from "../src/services/mail.service";
import logger from "../src/utils/logger";

// Sending is opt-in. Without --send (or --live) nothing is written or emailed.
const live =
  process.argv.includes("--send") || process.argv.includes("--live");
const dryRun = !live;

// Student to onboard.
const STUDENT = {
  matricNumber: "190407059",
  fullName: "Ahamsi Godsfavour",
  email: "ahamsiaceman@gmail.com",
  gender: "male" as const,
};

// Full Experience package code (see scripts/seed.ts).
const FULL_PACKAGE_CODE = "F";

async function run(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  if (dryRun) {
    logger.warn("🚧 DRY RUN — no DB writes, no email. Pass --send to apply.");
  }

  // Resolve the Full Experience package and verify it is the FULL type.
  const pkg = (await packageService.getPackageByCode(
    FULL_PACKAGE_CODE,
  )) as IPackage;

  if (pkg.packageType !== "FULL") {
    throw new Error(
      `Package "${pkg.code}" is "${pkg.packageType}", expected the FULL (Full Experience) package.`,
    );
  }

  logger.info(
    `🎟️  Package: ${pkg.name} (${pkg.code}) — full-week access, ₦${pkg.price}`,
  );
  logger.info(
    `👤 Student: ${STUDENT.fullName} | ${STUDENT.matricNumber} | ${STUDENT.email} | ${STUDENT.gender} | status=SPONSORSHIP`,
  );

  if (dryRun) {
    logger.info(
      "Would: upsert student as SPONSORSHIP, generate invite, and email it.",
    );
    logger.info("🎉 Dry run complete.");
    return;
  }

  // Upsert by matric number so re-running does not create duplicates.
  const matricNumber = STUDENT.matricNumber.toUpperCase();
  let student = await Student.findOne({ matricNumber });

  if (student) {
    logger.info("Existing student found — updating.");
    student.fullName = STUDENT.fullName;
    student.email = STUDENT.email;
    student.gender = STUDENT.gender;
    student.packageId = pkg._id as mongoose.Types.ObjectId;
    student.paymentStatus = PaymentStatus.SPONSORSHIP;
    student.totalPaid = 0;
  } else {
    student = new Student({
      fullName: STUDENT.fullName,
      matricNumber,
      email: STUDENT.email,
      gender: STUDENT.gender,
      packageId: pkg._id,
      selectedDays: [], // FULL package includes every day; selection unused
      totalPaid: 0,
      paymentStatus: PaymentStatus.SPONSORSHIP,
    });
  }
  await student.save();
  logger.info(`✓ Student saved (${student._id}) with status SPONSORSHIP`);

  // Generate the invite (FULL package => all event days) and persist it.
  const invite = await inviteService.generateInvites(student, pkg);
  student.invites = {
    imageUrl: invite.imageUrl,
    generatedAt: invite.generatedAt,
  };
  await student.save();
  logger.info(`✓ Invite generated: ${invite.imageUrl}`);

  // Email the invite to the student.
  await mailService.sendPaymentCompletionEmail(
    student.email!,
    student.fullName,
    pkg.name,
    invite.imageUrl,
  );
  logger.info(`✓ Invite emailed to ${student.email}`);

  logger.info("🎉 Done.");
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error("❌ Failed to add sponsored student:", error);
    await mongoose.disconnect();
    process.exit(1);
  });
