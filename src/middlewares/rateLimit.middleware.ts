import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const paymentRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  message: {
    success: false,
    message: "Too many payment requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Never throttle Flutterwave webhook deliveries — they all arrive from
  // Flutterwave's IPs and a burst (or retries) would otherwise be dropped.
  skip: (req) => req.originalUrl.includes("/webhooks"),
});
