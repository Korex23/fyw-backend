import { Router } from "express";
import webhookController from "../controllers/webhook.controller";

const router = Router();

// Paystack webhook endpoint
router.post(
  "/paystack",
  webhookController.handlePaystackWebhook.bind(webhookController),
);

export default router;
