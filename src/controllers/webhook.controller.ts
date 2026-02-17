import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import paymentService from "../services/payment.service";
import logger from "../utils/logger";
import { UnauthorizedError } from "../utils/errors";

export class WebhookController {
  async handleFlutterwaveWebhook(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const signature = req.headers["verif-hash"] as string;

      if (!signature) {
        throw new UnauthorizedError("Missing signature");
      }

      if (signature !== env.FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
        logger.warn("Invalid webhook signature received");
        throw new UnauthorizedError("Invalid signature");
      }

      const event = req.body?.type || req.body?.event;
      const data = req.body?.data || {};
      const reference = data?.tx_ref || data?.reference;

      logger.info(`Webhook received: ${event} for reference ${reference}`);

      // Generate a unique event ID
      const eventId = `${data?.id || reference}-${event}-${Date.now()}`;

      // Process webhook (idempotent)
      await paymentService.processWebhook(req.body, eventId);

      // Respond immediately to Flutterwave
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
