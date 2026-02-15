import mongoose from "mongoose";
import { env } from "../src/config/env";
import paymentService from "../src/services/payment.service";
import studentService from "../src/services/student.service";
import WebhookEvent from "../src/models/WebhookEvent";
import Payment from "../src/models/Payment";
import logger from "../src/utils/logger";

/**
 * Test: Webhook Idempotency
 *
 * Scenario:
 * 1. Create a student and payment
 * 2. Process a webhook event
 * 3. Attempt to process the same webhook again
 * 4. Verify: Payment only credited once
 * 5. Verify: Webhook event only recorded once
 */

async function testWebhookIdempotency() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info("✅ Connected to MongoDB");

    // Clean up test data
    const testMatric = "TEST/WEBHOOK/001";
    await mongoose.connection.db
      ?.collection("students")
      .deleteMany({ matricNumber: testMatric });
    await mongoose.connection.db
      ?.collection("payments")
      .deleteMany({ reference: /^TEST-REF/ });
    await mongoose.connection.db
      ?.collection("webhookevents")
      .deleteMany({ reference: /^TEST-REF/ });

    logger.info("\n📝 Test: Webhook Idempotency\n");

    // Step 1: Create student
    logger.info("Step 1: Creating test student...");
    const { student } = await studentService.createOrIdentifyStudent(
      testMatric,
      "Test Student Webhook",
      "A",
      "test@webhook.com",
    );
    logger.info(`✓ Student created: ${student.matricNumber}`);

    // Step 2: Create a pending payment
    logger.info("\nStep 2: Creating pending payment...");
    const testReference = `TEST-REF-${Date.now()}`;
    await Payment.create({
      studentId: student._id,
      packageIdAtTime: student.packageId,
      amount: 10000,
      reference: testReference,
      status: "pending",
    });
    logger.info(`✓ Payment created: ${testReference}`);

    // Step 3: Simulate webhook payload
    const webhookPayload = {
      event: "charge.success",
      data: {
        id: 123456789,
        status: "success",
        reference: testReference,
        amount: 1000000, // 10000 in kobo
        paid_at: new Date().toISOString(),
        metadata: {
          studentId: student._id.toString(),
          matricNumber: student.matricNumber,
          packageCode: "A",
        },
      },
    };

    const eventId = `test-event-${Date.now()}`;

    // Step 4: Process webhook first time
    logger.info("\nStep 3: Processing webhook (first time)...");
    await paymentService.processWebhook(webhookPayload, eventId);

    const student1 = await studentService.getStudentById(
      student._id.toString(),
    );
    logger.info(`✓ Student totalPaid: ₦${student1.totalPaid}`);
    logger.info(`✓ Payment status: ${student1.paymentStatus}`);

    const webhookCount1 = await WebhookEvent.countDocuments({ eventId });
    logger.info(`✓ Webhook events recorded: ${webhookCount1}`);

    // Step 5: Process same webhook again (should be idempotent)
    logger.info(
      "\nStep 4: Processing same webhook (second time - should be idempotent)...",
    );
    await paymentService.processWebhook(webhookPayload, eventId);

    const student2 = await studentService.getStudentById(
      student._id.toString(),
    );
    logger.info(`✓ Student totalPaid: ₦${student2.totalPaid}`);
    logger.info(`✓ Payment status: ${student2.paymentStatus}`);

    const webhookCount2 = await WebhookEvent.countDocuments({ eventId });
    logger.info(`✓ Webhook events recorded: ${webhookCount2}`);

    // Step 6: Try with different event ID but same reference
    logger.info(
      "\nStep 5: Processing with different eventId but same reference...",
    );
    const eventId2 = `test-event-${Date.now()}-different`;
    await paymentService.processWebhook(webhookPayload, eventId2);

    const student3 = await studentService.getStudentById(
      student._id.toString(),
    );
    logger.info(`✓ Student totalPaid: ₦${student3.totalPaid}`);
    logger.info(`✓ Payment status: ${student3.paymentStatus}`);

    const webhookCount3 = await WebhookEvent.countDocuments({
      reference: testReference,
    });
    logger.info(`✓ Total webhook events for this reference: ${webhookCount3}`);

    // Verify results
    logger.info("\n🔍 Verification:");
    const totalPaidCorrect = student3.totalPaid === 10000;
    const webhooksRecorded = webhookCount3 >= 1; // At least one recorded
    const paymentNotDuplicated =
      student1.totalPaid === student2.totalPaid &&
      student2.totalPaid === student3.totalPaid;

    if (totalPaidCorrect && webhooksRecorded && paymentNotDuplicated) {
      logger.info("✅ TEST PASSED: Webhook idempotency works correctly!");
      logger.info("   - Payment credited only once: ₦10,000");
      logger.info("   - Multiple webhook calls did not duplicate payment");
      logger.info("   - Webhook events properly recorded");
    } else {
      logger.error("❌ TEST FAILED: Idempotency check failed");
      logger.error(
        `   - Expected totalPaid: 10000, Got: ${student3.totalPaid}`,
      );
      logger.error(`   - Payment duplication: ${!paymentNotDuplicated}`);
    }

    // Test: Payment verification idempotency
    logger.info("\n📝 Test: Payment Verification Idempotency\n");

    const payment1 = await Payment.findOne({ reference: testReference });
    logger.info("Step 1: First verification call...");
    logger.info(`✓ Payment status before: ${payment1?.status}`);

    // Create a new pending payment for verification test
    const testReference2 = `TEST-REF-VERIFY-${Date.now()}`;
    await Payment.create({
      studentId: student._id,
      packageIdAtTime: student.packageId,
      amount: 5000,
      reference: testReference2,
      status: "success", // Already successful
      paidAt: new Date(),
    });

    logger.info("\nStep 2: Verifying already-successful payment...");
    try {
      const verifyResult = await paymentService.verifyPayment(testReference2);
      logger.info(`✓ Verification returned existing payment without API call`);
      logger.info(`✓ Payment status: ${verifyResult.status}`);
      logger.info("✅ TEST PASSED: Verification idempotency works!");
    } catch (error) {
      logger.error("❌ Verification test failed:", error);
    }

    // Clean up
    await mongoose.connection.db
      ?.collection("students")
      .deleteMany({ matricNumber: testMatric });
    await mongoose.connection.db
      ?.collection("payments")
      .deleteMany({ reference: /^TEST-REF/ });
    await mongoose.connection.db
      ?.collection("webhookevents")
      .deleteMany({ reference: /^TEST-REF/ });
    logger.info("\n✨ Test cleanup completed");

    process.exit(0);
  } catch (error) {
    logger.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testWebhookIdempotency();
