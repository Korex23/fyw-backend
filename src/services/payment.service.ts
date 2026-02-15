import Payment, { IPayment } from "../models/Payment";
import WebhookEvent from "../models/WebhookEvent";
import paystackClient from "../config/paystack";
import {
  TransactionStatus,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
} from "../types";
import { NotFoundError, BadRequestError } from "../utils/errors";
import { generateReference } from "../utils/helpers";
import studentService from "./student.service";
import packageService from "./package.service";
import inviteService from "./invite.service";
import mailService from "./mail.service";
import logger from "../utils/logger";
import { env } from "../config/env";

export class PaymentService {
  async initializePayment(
    studentId: string,
    amount: number,
    email: string,
  ): Promise<{
    authorization_url: string;
    reference: string;
    access_code: string;
  }> {
    const student = await studentService.getStudentByMatricNumber(studentId);
    logger.info(student);
    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestError("Amount must be greater than 0");
    }

    const outstanding = pkg.price - student.totalPaid;
    if (outstanding <= 0) {
      throw new BadRequestError("Package already fully paid");
    }

    const reference = generateReference();

    // Create pending payment record
    await Payment.create({
      studentId: student._id,
      packageIdAtTime: pkg._id,
      amount,
      reference,
      status: TransactionStatus.PENDING,
    });

    // Initialize Paystack transaction
    const response = await paystackClient.post<PaystackInitializeResponse>(
      "/transaction/initialize",
      {
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        metadata: {
          studentId: student._id.toString(),
          matricNumber: student.matricNumber,
          packageCode: pkg.code,
          packageName: pkg.name,
          fullName: student.fullName,
        },
        callback_url: `${env.FRONTEND_URL}/payment/verify?reference=${reference}`,
      },
    );

    if (!response.data.status) {
      throw new BadRequestError("Failed to initialize payment");
    }

    logger.info(
      `Payment initialized: ${reference} for student ${student.matricNumber}`,
    );

    return {
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
      access_code: response.data.data.access_code,
    };
  }

  async verifyPayment(reference: string): Promise<IPayment> {
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    // If already successful, return existing payment (idempotency)
    if (payment.status === TransactionStatus.SUCCESS) {
      logger.info(`Payment ${reference} already verified`);
      return payment;
    }

    // Verify with Paystack
    const response = await paystackClient.get<PaystackVerifyResponse>(
      `/transaction/verify/${reference}`,
    );

    if (!response.data.status) {
      throw new BadRequestError("Payment verification failed");
    }

    const { data } = response.data;

    if (data.status === "success") {
      await this.processSuccessfulPayment(payment, data);
    } else {
      payment.status = TransactionStatus.FAILED;
      payment.rawPaystackPayload = data;
      await payment.save();
    }

    return payment;
  }

  async processWebhook(eventData: any, eventId: string): Promise<void> {
    const { event, data } = eventData;

    // Check if event already processed (idempotency)
    const existingEvent = await WebhookEvent.findOne({
      eventId,
      reference: data.reference,
    });

    if (existingEvent) {
      logger.info(`Webhook event ${eventId} already processed`);
      return;
    }

    // Record webhook event (unique constraint prevents duplicate processing)
    try {
      await WebhookEvent.create({
        eventId,
        reference: data.reference,
        event,
        processedAt: new Date(),
        rawPayload: eventData,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        logger.info(`Webhook event ${eventId} already processed (duplicate)`);
        return;
      }
      throw error;
    }

    // Process charge.success events
    if (event === "charge.success") {
      const payment = await Payment.findOne({ reference: data.reference });

      if (!payment) {
        logger.warn(
          `Payment not found for webhook reference: ${data.reference}`,
        );
        return;
      }

      if (payment.status === TransactionStatus.SUCCESS) {
        logger.info(`Payment ${data.reference} already processed`);
        return;
      }

      await this.processSuccessfulPayment(payment, data);
    }
  }

  private async processSuccessfulPayment(
    payment: IPayment,
    paystackData: any,
  ): Promise<void> {
    const amountInNaira = paystackData.amount / 100;

    // Update payment record
    payment.status = TransactionStatus.SUCCESS;
    payment.paidAt = new Date(paystackData.paid_at);
    payment.rawPaystackPayload = paystackData;
    await payment.save();

    logger.info(
      `Processing successful payment: ${payment.reference} - ₦${amountInNaira}`,
    );

    // Update student payment status
    const student = await studentService.updatePaymentStatus(
      payment.studentId.toString(),
      amountInNaira,
    );

    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );
    const outstanding = Math.max(pkg.price - student.totalPaid, 0);

    // Send appropriate notification
    if (student.paymentStatus === "FULLY_PAID") {
      // Generate invites
      const invites = await inviteService.generateInvites(student, pkg);

      // Update student with invite URLs
      await studentService.updateInvites(
        student._id.toString(),
        invites.pdfUrl,
        invites.imageUrl,
      );

      // Send completion email
      if (student.email) {
        await mailService.sendPaymentCompletionEmail(
          student.email,
          student.fullName,
          pkg.name,
          invites.pdfUrl,
          invites.imageUrl,
        );
      }
    } else {
      // Send partial payment notification
      if (student.email) {
        await mailService.sendPartialPaymentEmail(
          student.email,
          student.fullName,
          amountInNaira,
          student.totalPaid,
          outstanding,
          pkg.name,
          pkg.price,
        );
      }
    }
  }

  async getPaymentByReference(reference: string): Promise<IPayment> {
    const payment = await Payment.findOne({ reference })
      .populate("studentId")
      .populate("packageIdAtTime");

    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    return payment;
  }
}

export default new PaymentService();
