import axios from "axios";
import Payment, { IPayment } from "../models/Payment";
import WebhookEvent from "../models/WebhookEvent";
import flutterwave from "../config/flutterwave";
import {
  TransactionStatus,
  FlutterwaveInitializeResponse,
  FlutterwaveVerifyResponse,
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
  private extractGatewayError(error: any): string {
    const gatewayData = error?.response?.data;
    if (!gatewayData) {
      return error?.message || "Failed to initialize payment";
    }
    return (
      gatewayData?.message ||
      gatewayData?.data?.message ||
      gatewayData?.error?.message ||
      gatewayData?.error ||
      "Failed to initialize payment"
    );
  }

  async initializePayment(
    studentId: string,
    amount: number,
    email: string,
  ): Promise<{
    authorization_url: string;
    reference: string;
  }> {
    const student = await studentService.getStudentByMatricNumber(studentId);
    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );

    if (amount <= 0) {
      throw new BadRequestError("Amount must be greater than 0");
    }

    const outstanding = pkg.price - student.totalPaid;
    if (outstanding <= 0) {
      throw new BadRequestError("Package already fully paid");
    }

    const reference = generateReference();

    await Payment.create({
      studentId: student._id,
      packageIdAtTime: pkg._id,
      amount,
      reference,
      status: TransactionStatus.PENDING,
    });

    const redirectUrl =
      env.FLUTTERWAVE_REDIRECT_URL || `${env.FRONTEND_URL}/payment/verify`;
    const redirectHost = new URL(redirectUrl).hostname.toLowerCase();
    if (redirectHost === "localhost" || redirectHost === "127.0.0.1") {
      throw new BadRequestError(
        "FLUTTERWAVE_REDIRECT_URL must be a public URL (localhost is invalid)",
      );
    }

    try {
      const { data: response } = await axios.post<FlutterwaveInitializeResponse>(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: reference,
          amount,
          currency: "NGN",
          redirect_url: redirectUrl,
          customer: {
            email,
            phonenumber: student.phone || "08000000000",
            name: student.fullName,
          },
          meta: {
            studentId: student._id.toString(),
            matricNumber: student.matricNumber,
            packageCode: pkg.code,
            packageName: pkg.name,
            selectedDays: student.selectedDays || [],
            fullName: student.fullName,
          },
          customizations: {
            title: "ULES Final Year Week Payment",
            description: `Payment for ${pkg.name}`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status !== "success" || !response.data?.link) {
        logger.error({ response }, "Flutterwave initialize returned non-success");
        throw new BadRequestError(
          response.message || "Failed to initialize payment",
        );
      }

      logger.info(
        `Payment initialized: ${reference} for student ${student.matricNumber}`,
      );

      return {
        authorization_url: response.data.link,
        reference,
      };
    } catch (error: any) {
      logger.error(
        {
          status: error?.response?.status,
          data: error?.response?.data,
        },
        "Flutterwave initialize failed",
      );
      throw new BadRequestError(this.extractGatewayError(error));
    }
  }

  async verifyPayment(reference: string): Promise<IPayment> {
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    if (payment.status === TransactionStatus.SUCCESS) {
      logger.info(`Payment ${reference} already verified`);
      return payment;
    }

    const response = await flutterwave.Transaction.verify_by_tx({
      tx_ref: reference,
    });

    if (response.status !== "success") {
      throw new BadRequestError("Payment verification failed");
    }

    const data = response.data as FlutterwaveVerifyResponse["data"];

    if (data.status === "successful") {
      await this.processSuccessfulPayment(payment, data);
    } else {
      payment.status = TransactionStatus.FAILED;
      payment.rawGatewayPayload = data;
      await payment.save();
    }

    return payment;
  }

  async processWebhook(eventData: any, eventId: string): Promise<void> {
    const event = eventData?.event;
    const data = eventData?.data || {};
    const reference = data?.tx_ref || data?.reference;

    if (!reference) {
      logger.warn("Webhook payload missing transaction reference");
      return;
    }

    const existingEvent = await WebhookEvent.findOne({ eventId, reference });
    if (existingEvent) {
      logger.info(`Webhook event ${eventId} already processed`);
      return;
    }

    try {
      await WebhookEvent.create({
        eventId,
        reference,
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

    if (event === "charge.completed" && data.status === "successful") {
      const payment = await Payment.findOne({ reference });

      if (!payment) {
        logger.warn(`Payment not found for webhook reference: ${reference}`);
        return;
      }

      if (payment.status === TransactionStatus.SUCCESS) {
        logger.info(`Payment ${reference} already processed`);
        return;
      }

      await this.processSuccessfulPayment(payment, data);
    }
  }

  private async processSuccessfulPayment(
    payment: IPayment,
    flutterwaveData: any,
  ): Promise<void> {
    const amountInNaira = Number(flutterwaveData.amount);

    if (!Number.isFinite(amountInNaira) || amountInNaira <= 0) {
      throw new BadRequestError("Invalid payment amount from gateway");
    }

    payment.status = TransactionStatus.SUCCESS;
    payment.paidAt = new Date(
      flutterwaveData.paid_at || flutterwaveData.created_at || Date.now(),
    );
    payment.rawGatewayPayload = flutterwaveData;
    await payment.save();

    logger.info(
      `Processing successful payment: ${payment.reference} - N${amountInNaira}`,
    );

    const student = await studentService.updatePaymentStatus(
      payment.studentId.toString(),
      amountInNaira,
    );

    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );
    const outstanding = Math.max(pkg.price - student.totalPaid, 0);

    if (student.paymentStatus === "FULLY_PAID") {
      const invites = await inviteService.generateInvites(student, pkg);

      await studentService.updateInvites(
        student._id.toString(),
        invites.pdfUrl,
        invites.imageUrl,
      );

      if (student.email) {
        await mailService.sendPaymentCompletionEmail(
          student.email,
          student.fullName,
          pkg.name,
          invites.pdfUrl,
          invites.imageUrl,
        );
      }
    } else if (student.email) {
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
