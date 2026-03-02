import mongoose from "mongoose";
import { env } from "../src/config/env";
import packageService from "../src/services/package.service";
import Package from "../src/models/Package";
import logger from "../src/utils/logger";

const packages = [
  {
    code: "T",
    name: "Corporate Plus",
    packageType: "CORPORATE_PLUS" as const,
    price: 30000,
    benefits: [
      "Access to Corporate Day (Monday) + 1 chosen day (Tue, Wed, or Thu)",
      "Custom day-based entry invite",
      "Option to upgrade to Corporate & Owambe or Full Experience",
    ],
  },
  {
    code: "C",
    name: "Corporate & Owambe",
    packageType: "CORPORATE_OWAMBE" as const,
    price: 40000,
    benefits: [
      "Access to Corporate Day (Monday) + Cultural Day/Owambe (Friday)",
      "Custom two-day entry invite",
      "Option to upgrade to Full Experience",
    ],
  },
  {
    code: "F",
    name: "Full Experience",
    packageType: "FULL" as const,
    price: 60000,
    benefits: [
      "Access to all 5 event days (Mon-Fri)",
      "Official full-week invitation pass",
      "Priority support and complete event access",
    ],
  },
];

async function seed() {
  try {
    // Connect to database
    await mongoose.connect(env.MONGODB_URI);
    logger.info("✅ Connected to MongoDB");

    // Create or update packages
    logger.info("🌱 Seeding packages...");

    await Package.deleteMany({ code: { $nin: packages.map((pkg) => pkg.code) } });

    for (const pkg of packages) {
      const created = await packageService.createOrUpdatePackage(
        pkg.code,
        pkg.name,
        pkg.packageType,
        pkg.price,
        pkg.benefits,
      );
      logger.info(
        `✓ Package ${created.code} - ${created.name} (₦${created.price})`,
      );
    }

    logger.info("🎉 Seeding completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seed();
