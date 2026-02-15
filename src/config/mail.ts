import nodemailer, { Transporter } from "nodemailer";
import { env } from "./env";
import logger from "../utils/logger";

class MailConfig {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: parseInt(env.SMTP_PORT),
      secure: env.SMTP_SECURE === "true",
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });

    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info("SMTP connection verified");
    } catch (error) {
      logger.error("SMTP connection error:", error);
    }
  }

  getTransporter(): Transporter {
    return this.transporter;
  }
}

export default new MailConfig().getTransporter();
