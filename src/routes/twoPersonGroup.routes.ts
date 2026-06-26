import { Router } from "express";
import twoPersonGroupController, {
  registerTwoPersonGroupSchema,
  initializeTwoPersonGroupPaymentSchema,
  getTwoPersonGroupSchema,
} from "../controllers/twoPersonGroup.controller";
import { validate } from "../middlewares/validation.middleware";
import { paymentRateLimiter } from "../middlewares/rateLimit.middleware";

const router = Router();

router.post(
  "/register",
  validate(registerTwoPersonGroupSchema),
  twoPersonGroupController.registerGroup.bind(twoPersonGroupController),
);

router.post(
  "/:groupId/pay",
  paymentRateLimiter,
  validate(initializeTwoPersonGroupPaymentSchema),
  twoPersonGroupController.initializePayment.bind(twoPersonGroupController),
);

router.get(
  "/:groupId",
  validate(getTwoPersonGroupSchema),
  twoPersonGroupController.getGroup.bind(twoPersonGroupController),
);

export default router;
