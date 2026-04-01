/**
 * Purge students whose matric numbers don't match the valid schema.
 *
 * Valid matric: starts with 1904 or 2104, exactly 9 digits, no letters.
 *
 * Flags:
 *   --force     Skip the confirmation prompt and delete immediately
 *   --dry-run   Print what would be deleted without touching the database
 *
 * Usage:
 *   npm run purge:defaulting
 *   npm run purge:defaulting -- --dry-run
 *   npm run purge:defaulting -- --force
 */

import mongoose from "mongoose";
import * as readline from "readline";
import { env } from "../src/config/env";
import Student from "../src/models/Student";
import Payment from "../src/models/Payment";
import logger from "../src/utils/logger";

const VALID_MATRIC = /^(1904|2104)\d{5}$/;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY_RUN = args.includes("--dry-run");

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

async function purge() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("Connected to MongoDB");

  // Fetch all students and filter in-process (MongoDB regex doesn't support lookaheads)
  const allStudents = await Student.find({}).select(
    "matricNumber fullName paymentStatus totalPaid",
  );

  const invalid = allStudents.filter((s) => !VALID_MATRIC.test(s.matricNumber));

  if (invalid.length === 0) {
    logger.info("No students with invalid matric numbers found. Nothing to purge.");
    process.exit(0);
  }

  const invalidIds = invalid.map((s) => s._id);
  const paymentCount = await Payment.countDocuments({ studentId: { $in: invalidIds } });

  console.log("\n========== INVALID MATRIC STUDENTS ==========");
  for (const s of invalid) {
    console.log(
      `  ${s.matricNumber.padEnd(15)} ${s.fullName.padEnd(30)} [${s.paymentStatus}]  paid: ₦${s.totalPaid}`,
    );
  }
  console.log("==============================================");
  console.log(`\nStudents to delete : ${invalid.length}`);
  console.log(`Payments to delete : ${paymentCount}`);
  console.log(`Rule               : matric must match /^(1904|2104)\\d{5}$/\n`);

  if (DRY_RUN) {
    logger.info("Dry run — no data was deleted.");
    process.exit(0);
  }

  if (!FORCE) {
    const ok = await confirm(
      `Type "y" to permanently delete these ${invalid.length} student(s) and their ${paymentCount} payment record(s): `,
    );
    if (!ok) {
      logger.info("Aborted. No data was deleted.");
      process.exit(0);
    }
  }

  const deletedPayments = await Payment.deleteMany({ studentId: { $in: invalidIds } });
  const deletedStudents = await Student.deleteMany({ _id: { $in: invalidIds } });

  logger.info(
    `Purge complete — deleted ${deletedStudents.deletedCount} student(s) and ${deletedPayments.deletedCount} payment record(s).`,
  );
  process.exit(0);
}

purge().catch((err) => {
  logger.error(err, "Purge script failed");
  process.exit(1);
});
