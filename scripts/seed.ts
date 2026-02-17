import mongoose from "mongoose";
import { env } from "../src/config/env";
import packageService from "../src/services/package.service";
import Package from "../src/models/Package";
import logger from "../src/utils/logger";

const packages = [
  {
    code: "T",
    name: "Two-Day Experience",
    packageType: "TWO_DAY" as const,
    price: 30000,
    benefits: [
      "Access to any 2 selected event days (Mon-Fri)",
      "Custom day-based entry invite",
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
