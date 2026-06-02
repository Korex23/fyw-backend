import { Router } from "express";
import groupController, {
  registerGroupSchema,
  initializeGroupPaymentSchema,
  getGroupSchema,
} from "../controllers/group.controller";
import { validate } from "../middlewares/validation.middleware";
import { paymentRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

// Register a group of 3 (no payment — returns groupId)
router.post(
  "/register",
  validate(registerGroupSchema),
  groupController.registerGroup.bind(groupController),
);

// Initialize a payment for an existing group (partial or full)
router.post(
  "/:groupId/pay",
  paymentRateLimiter,
  validate(initializeGroupPaymentSchema),
  groupController.initializePayment.bind(groupController),
);

// Get group registration status
router.get(
  "/:groupId",
  validate(getGroupSchema),
  groupController.getGroup.bind(groupController),
);

export default router;
