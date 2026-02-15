import mongoose from "mongoose";
import { env } from "../src/config/env";
import packageService from "../src/services/package.service";
import studentService from "../src/services/student.service";
import logger from "../src/utils/logger";

/**
 * Test: Package Upgrade with Payment Preservation
 *
 * Scenario:
 * 1. Student selects Package B (₦25,000)
 * 2. Student makes partial payment of ₦15,000
 * 3. Student upgrades to Package C (₦40,000)
 * 4. Verify: totalPaid remains ₦15,000
 * 5. Verify: Outstanding becomes ₦25,000 (40,000 - 15,000)
 */

async function testUpgrade() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info("✅ Connected to MongoDB");

    // Clean up test data
    const testMatric = "TEST/UPGRADE/001";
    await mongoose.connection.db
      ?.collection("students")
      .deleteMany({ matricNumber: testMatric });
    await mongoose.connection.db?.collection("payments").deleteMany({
      studentId: { $exists: false }, // Clean up any orphaned test payments
    });

    logger.info("\n📝 Test: Package Upgrade with Payment Preservation\n");

    // Step 1: Create student with Package B
    logger.info("Step 1: Creating student with Package B...");
    const { student: student1 } = await studentService.createOrIdentifyStudent(
      testMatric,
      "Test Student Upgrade",
      "B",
      "test@upgrade.com",
    );
    const pkgB = await packageService.getPackageByCode("B");
    logger.info(`✓ Student created: ${student1.matricNumber}`);
    logger.info(`✓ Package: ${pkgB.name} (₦${pkgB.price})`);
    logger.info(`✓ Total Paid: ₦${student1.totalPaid}`);
    logger.info(`✓ Status: ${student1.paymentStatus}`);

    // Step 2: Simulate partial payment
    logger.info("\nStep 2: Simulating partial payment of ₦15,000...");
    const updatedStudent1 = await studentService.updatePaymentStatus(
      student1._id.toString(),
      15000,
    );
    logger.info(`✓ Total Paid: ₦${updatedStudent1.totalPaid}`);
    logger.info(`✓ Status: ${updatedStudent1.paymentStatus}`);
    logger.info(`✓ Outstanding: ₦${pkgB.price - updatedStudent1.totalPaid}`);

    // Step 3: Upgrade to Package C
    logger.info("\nStep 3: Upgrading to Package C...");
    const upgradedStudent = await studentService.upgradePackage(
      testMatric,
      "C",
    );
    const pkgC = await packageService.getPackageByCode("C");
    logger.info(`✓ New Package: ${pkgC.name} (₦${pkgC.price})`);
    logger.info(`✓ Total Paid (preserved): ₦${upgradedStudent.totalPaid}`);
    logger.info(`✓ Status: ${upgradedStudent.paymentStatus}`);
    logger.info(
      `✓ New Outstanding: ₦${pkgC.price - upgradedStudent.totalPaid}`,
    );

    // Verify results
    logger.info("\n🔍 Verification:");
    const verified =
      upgradedStudent.totalPaid === 15000 &&
      upgradedStudent.paymentStatus === "PARTIALLY_PAID" &&
      pkgC.price - upgradedStudent.totalPaid === 25000;

    if (verified) {
      logger.info("✅ TEST PASSED: Upgrade logic works correctly!");
      logger.info("   - Previous payments preserved: ₦15,000");
      logger.info("   - Outstanding correctly calculated: ₦25,000");
      logger.info("   - Payment status updated: PARTIALLY_PAID");
    } else {
      logger.error("❌ TEST FAILED: Verification failed");
    }

    // Test downgrade prevention
    logger.info("\n📝 Test: Downgrade Prevention\n");
    try {
      await studentService.upgradePackage(testMatric, "A");
      logger.error(
        "❌ TEST FAILED: Downgrade was allowed (should be prevented)",
      );
    } catch (error: any) {
      if (error.message.includes("higher-priced")) {
        logger.info("✅ TEST PASSED: Downgrade correctly prevented");
      } else {
        logger.error("❌ TEST FAILED: Wrong error message");
      }
    }

    // Clean up
    await mongoose.connection.db
      ?.collection("students")
      .deleteMany({ matricNumber: testMatric });
    logger.info("\n✨ Test cleanup completed");

    process.exit(0);
  } catch (error) {
    logger.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testUpgrade();
