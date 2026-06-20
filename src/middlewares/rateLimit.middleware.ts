import rateLimit, { Options } from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../config/env";
import logger from "../utils/logger";

// Normalize the client IP for use as a rate-limit key. IPv6 clients are bucketed
// by their /64 prefix, since a single user can otherwise rotate through many
// addresses within their allocation.
const ipFallback = (req: Request): string => {
  const ip = req.ip ?? "unknown";
  if (ip.includes(":")) {
    return `ip:${ip.split(":").slice(0, 4).join(":")}`; // /64 prefix
  }
  return `ip:${ip}`;
};

// Key the limit by the client-supplied device id — a stable UUID the frontend
// generates once and stores in localStorage, sent as the X-Device-Id header.
// This stops users behind a shared NAT (e.g. a whole hostel on one public IP)
// from colliding in the same bucket. Falls back to IP when the header is absent.
// Device ids are client-controlled and spoofable, so this is paired with the
// IP-keyed generalRateLimiter, which remains the per-IP abuse ceiling.
const deviceKey = (req: Request): string => {
  const deviceId = req.header("x-device-id")?.trim();
  if (deviceId) return `device:${deviceId}`;
  return ipFallback(req);
};

// Shared handler that logs whenever a client is throttled, then sends the
// configured response. Logs the limiter name, the key that tripped, the real
// IP, the device id (if any), and the route.
const limitedHandler =
  (name: string) =>
  (req: Request, res: Response, _next: unknown, options: Options) => {
    logger.warn(
      {
        limiter: name,
        key: options.keyGenerator(req, res),
        ip: req.ip,
        deviceId: req.header("x-device-id") ?? null,
        method: req.method,
        path: req.originalUrl,
        limit: options.limit,
        windowMs: options.windowMs,
      },
      "Rate limit exceeded",
    );
    res.status(options.statusCode).json(options.message);
  };

export const paymentRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  keyGenerator: deviceKey,
  message: {
    success: false,
    message: "Too many payment requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitedHandler("payment"),
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
  handler: limitedHandler("general"),
  // Never throttle Flutterwave webhook deliveries — they all arrive from
  // Flutterwave's IPs and a burst (or retries) would otherwise be dropped.
  skip: (req) => req.originalUrl.includes("/webhooks"),
});
