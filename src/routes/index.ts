import { Router } from "express";
import studentRoutes from "./students.routes";
import paymentRoutes from "./payment.routes";
import adminRoutes from "./admin.routes";
import webhookRoutes from "./webhook.routes";
import groupRoutes from "./group.routes";
import twoPersonGroupRoutes from "./twoPersonGroup.routes";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API routes
router.use("/students", studentRoutes);
router.use("/payments", paymentRoutes);
router.use("/admin", adminRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/group", groupRoutes);
router.use("/two-person-group", twoPersonGroupRoutes);

export default router;
