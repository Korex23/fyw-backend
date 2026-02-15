import { Router } from "express";
import adminController, {
  loginSchema,
  studentFiltersSchema,
} from "../controllers/admin.controller";
import { validate } from "../middlewares/validation.middleware";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Auth routes
router.post(
  "/auth/login",
  validate(loginSchema),
  adminController.login.bind(adminController),
);

// // Protected admin routes
// router.use(authenticate);

// Metrics
router.get(
  "/metrics",
  authenticate,
  adminController.getMetrics.bind(adminController),
);

// Students management
router.get(
  "/students",
  authenticate,
  validate(studentFiltersSchema),
  adminController.getStudents.bind(adminController),
);

router.get(
  "/students/:id",
  authenticate,
  adminController.getStudentDetails.bind(adminController),
);

router.post(
  "/students/:id/resend-invite",
  authenticate,
  adminController.resendInvite.bind(adminController),
);

router.post(
  "/students/:id/regenerate-invite",
  authenticate,
  adminController.regenerateInvite.bind(adminController),
);

// Export
router.get(
  "/export.csv",
  authenticate,
  adminController.exportCSV.bind(adminController),
);

export default router;
