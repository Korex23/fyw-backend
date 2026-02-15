import { Router } from "express";
import paymentController, {
  initializePaymentSchema,
  verifyPaymentSchema,
} from "../controllers/payment.controller";
import { validate } from "../middlewares/validation.middleware";
import { paymentRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// Initialize payment
router.post(
  "/initialize",
  paymentRateLimiter,
  validate(initializePaymentSchema),
  paymentController.initializePayment.bind(paymentController),
);

// Verify payment
router.get(
  "/verify",
  validate(verifyPaymentSchema),
  paymentController.verifyPayment.bind(paymentController),
);

export default router;
