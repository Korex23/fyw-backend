/**
 * Save house assignments to each student's record.
 *
 * Reads house_assignments_balanced.csv (the balanced house allocation) and
 * persists each student's `house` + `houseWhatsappLink` onto their Student
 * document, matching by email.
 *
 * Usage:
 *   npm run houses:save           # apply the assignments
 *   npm run houses:save -- --dry  # preview without writing
 */
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student from "../src/models/Student";
import {
  HOUSES,
  normaliseHouse,
  HouseName,
} from "../src/constants/houses";
import logger from "../src/utils/logger";

const CSV_PATH = path.resolve(
  __dirname,
  "..",
  "house_assignments_balanced.csv",
);

interface Assignment {
  name: string;
  email: string;
  gender: string;
  house: HouseName;
  whatsappLink: string;
}

/**
 * Parse the assignment CSV. Names may contain commas, but the trailing four
 * columns (Email, Gender, House, WhatsApp Link) never do, so we anchor from
 * the right-hand side.
 */
function parseAssignments(): Assignment[] {
  const raw = fs.readFileSync(CSV_PATH, "utf8").trim();
  const lines = raw.split(/\r?\n/);
  lines.shift(); // drop header

  const assignments: Assignment[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols.length < 5) {
      logger.warn(`Skipping malformed row: ${line}`);
      continue;
    }
    const whatsappLink = cols[cols.length - 1].trim();
    const rawHouse = cols[cols.length - 2].trim();
    const gender = cols[cols.length - 3].trim();
    const email = cols[cols.length - 4].trim().toLowerCase();
    const name = cols.slice(0, cols.length - 4).join(",").trim();

    const house = normaliseHouse(rawHouse);
    if (!house) {
      logger.warn(`Skipping row with unknown house "${rawHouse}": ${name}`);
      continue;
    }
    assignments.push({ name, email, gender, house, whatsappLink });
  }
  return assignments;
}

async function run() {
  const dryRun = process.argv.includes("--dry");

  const assignments = parseAssignments();
  logger.info(
    `Parsed ${assignments.length} house assignments from ${path.basename(CSV_PATH)}`,
  );

  await mongoose.connect(env.MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  let updated = 0;
  let unchanged = 0;
  const unmatched: string[] = [];

  for (const a of assignments) {
    if (!a.email) {
      unmatched.push(`${a.name} (no email)`);
      continue;
    }

    const student = await Student.findOne({ email: a.email });
    if (!student) {
      unmatched.push(`${a.name} <${a.email}>`);
      continue;
    }

    // Prefer the canonical WhatsApp link from config; fall back to CSV value.
    const link = HOUSES[a.house].whatsappLink || a.whatsappLink;

    if (
      student.house === a.house &&
      student.houseWhatsappLink === link
    ) {
      unchanged++;
      continue;
    }

    logger.info(
      `${dryRun ? "[dry] " : ""}${student.fullName} <${a.email}> -> ${a.house} House`,
    );

    if (!dryRun) {
      student.house = a.house;
      student.houseWhatsappLink = link;
      await student.save();
    }
    updated++;
  }

  logger.info("──────────────────────────────────────────────");
  logger.info(`${dryRun ? "[DRY RUN] " : ""}Assignments processed`);
  logger.info(`  Updated:   ${updated}`);
  logger.info(`  Unchanged: ${unchanged}`);
  logger.info(`  Unmatched: ${unmatched.length}`);
  if (unmatched.length) {
    logger.warn("Students in CSV with no matching DB record:");
    unmatched.forEach((u) => logger.warn(`  - ${u}`));
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  logger.error("❌ Failed to save house assignments:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
