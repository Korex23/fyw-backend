/**
 * Swap event days between Wednesday and Thursday for affected students, then
 * email each one (with a freshly regenerated invite) explaining the move.
 *
 * Background: the event themes were swapped between the two days —
 *   - Jersey Day  : Wednesday  ->  Thursday
 *   - Costume Day : Thursday   ->  Wednesday
 * To keep every student attending the theme they originally chose, their
 * selected day is swapped accordingly:
 *   - Picked WEDNESDAY (old Jersey)  -> moved to THURSDAY  ("Jersey moved to Thursday")
 *   - Picked THURSDAY  (old Costume) -> moved to WEDNESDAY ("Costume now on Wednesday")
 *
 * Scope / rules:
 *   - FULLY_PAID students only.
 *   - Two-/three-day packages only (everything except the FULL package). Full
 *     package holders attend every day, so the swap is a no-op for them and they
 *     are never contacted.
 *   - A student holding BOTH Wednesday and Thursday (or NEITHER) is skipped — the
 *     swap would not change their access, so no email is sent.
 *
 * Idempotency: once a student has been swapped, `daySwapAppliedAt` is set and the
 * student is skipped on subsequent runs. This is essential — without it a second
 * run would swap people back. `--resend` is intentionally NOT supported for the
 * swap itself; to only re-send an email use a one-off, never re-run the swap.
 *
 * Usage:
 *   npm run days:swap                 # DRY RUN (default) — no email, no writes
 *   npm run days:swap -- --send       # actually swap days, regenerate invites + email
 *
 * Sending is opt-in: you MUST pass --send (after `--`). Anything else is a dry run.
 */
import mongoose from "mongoose";
import { env } from "../src/config/env";
import Student, { IStudent } from "../src/models/Student";
import Package, { IPackage } from "../src/models/Package";
import { PaymentStatus } from "../src/types";
import { EventDayKey } from "../src/constants/eventDays";
import { DaySwapType } from "../src/constants/daySwap";
import inviteService from "../src/services/invite.service";
import mailService from "../src/services/mail.service";
import logger from "../src/utils/logger";

// SAFETY: sending is opt-in. Without an explicit --send (or --live) flag this
// script ALWAYS runs as a dry run — it never sends email or writes to the DB.
const live =
  process.argv.includes("--send") || process.argv.includes("--live");
const dryRun = !live;

const WEDNESDAY: EventDayKey = "WEDNESDAY";
const THURSDAY: EventDayKey = "THURSDAY";

interface SwapPlan {
  newDays: EventDayKey[];
  swapType: DaySwapType;
}

/**
 * Decide how (or whether) a student's days should swap.
 * Returns null when the swap would not change their access (has both days, or
 * has neither) — those students are left untouched and not emailed.
 */
function planSwap(selectedDays: EventDayKey[]): SwapPlan | null {
  const hasWed = selectedDays.includes(WEDNESDAY);
  const hasThu = selectedDays.includes(THURSDAY);

  // Both or neither -> swapping is a no-op for this student.
  if (hasWed === hasThu) return null;

  if (hasWed) {
    return {
      newDays: selectedDays.map((d) => (d === WEDNESDAY ? THURSDAY : d)),
      swapType: "WED_TO_THU",
    };
  }
  return {
    newDays: selectedDays.map((d) => (d === THURSDAY ? WEDNESDAY : d)),
    swapType: "THU_TO_WED",
  };
}

async function run() {
  if (dryRun) {
    logger.info(
      "🧪 DRY RUN — no emails will be sent and nothing will be written. Pass `-- --send` to go live.",
    );
  } else {
    logger.warn(
      "🚨 LIVE MODE — days will be swapped, invites regenerated, and real emails sent.",
    );
  }

  await mongoose.connect(env.MONGODB_URI);
  logger.info("✅ Connected to MongoDB");

  // Non-FULL packages = the two-/three-day packages in scope.
  const eligiblePackages = await Package.find({
    packageType: { $ne: "FULL" },
  });
  const eligiblePackageIds = eligiblePackages.map((p) => p._id);
  const packageById = new Map<string, IPackage>(
    eligiblePackages.map((p) => [p._id.toString(), p]),
  );
  logger.info(
    `In-scope packages (non-FULL): ${eligiblePackages
      .map((p) => `${p.code}/${p.name}`)
      .join(", ")}`,
  );

  const students: IStudent[] = await Student.find({
    paymentStatus: PaymentStatus.FULLY_PAID,
    packageId: { $in: eligiblePackageIds },
    daySwapAppliedAt: { $exists: false },
    email: { $exists: true, $nin: [null, ""] },
  });

  logger.info(
    `Found ${students.length} fully-paid student(s) in scope not yet swapped.`,
  );

  let wedToThu = 0;
  let thuToWed = 0;
  let emailed = 0;
  let skippedNoOp = 0; // had both days or neither -> nothing to swap
  const failures: string[] = [];

  for (const student of students) {
    const pkg = packageById.get(student.packageId.toString());
    if (!pkg) {
      // Should not happen given the query, but guard anyway.
      logger.warn(`Skipping ${student.matricNumber}: package not found.`);
      continue;
    }

    const plan = planSwap(student.selectedDays || []);
    if (!plan) {
      skippedNoOp++;
      continue;
    }

    const label =
      plan.swapType === "WED_TO_THU"
        ? "Wednesday → Thursday (Jersey)"
        : "Thursday → Wednesday (Costume)";

    if (dryRun) {
      logger.info(
        `[dry] ${student.fullName} (${student.matricNumber}, ${pkg.code}): ` +
          `${(student.selectedDays || []).join(",")} -> ${plan.newDays.join(",")} | ${label} | would email ${student.email}`,
      );
      if (plan.swapType === "WED_TO_THU") wedToThu++;
      else thuToWed++;
      emailed++;
      continue;
    }

    try {
      // 1. Apply the swap.
      student.selectedDays = plan.newDays;

      // 2. Regenerate the invite to reflect the new access day.
      const invite = await inviteService.generateInvites(student, pkg);
      student.invites = {
        imageUrl: invite.imageUrl,
        generatedAt: invite.generatedAt,
      };

      // 3. Mark as swapped BEFORE emailing so we never double-swap, then save.
      student.daySwapAppliedAt = new Date();
      await student.save();

      // 4. Notify the student with the new invite.
      await mailService.sendDaySwapEmail(
        student.email as string,
        student.fullName,
        pkg.name,
        invite.imageUrl,
        plan.swapType,
      );

      if (plan.swapType === "WED_TO_THU") wedToThu++;
      else thuToWed++;
      emailed++;
      logger.info(`Swapped + emailed ${student.fullName} (${label}).`);
    } catch (err) {
      failures.push(`${student.email} (${(err as Error).message})`);
      logger.error(`Failed to process ${student.matricNumber}:`, err);
    }
  }

  logger.info("──────────────────────────────────────────────");
  logger.info(`${dryRun ? "[DRY RUN] " : ""}Day swap complete`);
  logger.info(`  Wednesday → Thursday (Jersey):  ${wedToThu}`);
  logger.info(`  Thursday → Wednesday (Costume): ${thuToWed}`);
  logger.info(`  Emailed:                        ${emailed}`);
  logger.info(`  Skipped (had both/neither day): ${skippedNoOp}`);
  logger.info(`  Failed:                         ${failures.length}`);
  if (failures.length) {
    failures.forEach((f) => logger.warn(`  - ${f}`));
  }

  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
}

run().catch(async (err) => {
  logger.error("❌ Failed to swap days and mail:", err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
