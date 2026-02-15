import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import paymentService from "../services/payment.service";
import logger from "../utils/logger";
import { UnauthorizedError } from "../utils/errors";

export class WebhookController {
  async handlePaystackWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const signature = req.headers["x-paystack-signature"] as string;

      if (!signature) {
        throw new UnauthorizedError("Missing signature");
      }

      // Verify signature
      const hash = crypto
        .createHmac("sha512", env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== signature) {
        logger.warn("Invalid webhook signature received");
        throw new UnauthorizedError("Invalid signature");
      }

      const { event, data } = req.body;

      logger.info(`Webhook received: ${event} for reference ${data.reference}`);

      // Generate a unique event ID
      const eventId = `${data.id}-${event}-${Date.now()}`;

      // Process webhook (idempotent)
      await paymentService.processWebhook(req.body, eventId);

      // Respond immediately to Paystack
      res.status(200).json({
        success: true,
        message: "Webhook processed",
      });
    } catch (error) {
      logger.error("Webhook processing error:", error);
      next(error);
    }
  }
}

export default new WebhookController();
