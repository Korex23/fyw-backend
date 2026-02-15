import mongoose from "mongoose";
import { env } from "./env";
import logger from "../utils/logger";

export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("⚠️  MongoDB disconnected");
});

mongoose.connection.on("error", (error) => {
  logger.error("❌ MongoDB error:", error);
});
