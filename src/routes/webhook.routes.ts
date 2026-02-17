import { Router } from "express";
import webhookController from "../controllers/webhook.controller";

const router = Router();

// Flutterwave webhook endpoint
router.post(
  "/flutterwave",
  webhookController.handleFlutterwaveWebhook.bind(webhookController),
);

export default router;
