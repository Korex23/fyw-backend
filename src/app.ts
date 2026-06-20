import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDatabase } from "./config/database";
import routes from "./routes";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { generalRateLimiter } from "./middlewares/rateLimit.middleware";
import logger from "./utils/logger";
import { env } from "./config/env";

const app: Application = express();

// Behind Caddy reverse proxy — trust the single proxy hop so express-rate-limit
// keys off the real client IP (X-Forwarded-For) instead of 127.0.0.1. Without
// this, every request shares one bucket and the whole app returns 429.
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging — logs every request on completion with the client identity
// and the rate-limit budget remaining (from express-rate-limit standard headers).
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        ip: req.ip,
        deviceId: req.header("x-device-id") ?? null,
        durationMs: Date.now() - start,
        rateLimitLimit: res.getHeader("ratelimit-limit"),
        rateLimitRemaining: res.getHeader("ratelimit-remaining"),
      },
      "request",
    );
  });
  next();
});

// Rate limiting
app.use("/api", generalRateLimiter);

// Routes
app.use("/api", routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = parseInt(env.PORT) || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
      logger.info(`API available at http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("Unhandled Rejection:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();

export default app;
