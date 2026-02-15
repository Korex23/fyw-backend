import mongoose from "mongoose";
import { env } from "../src/config/env";
import packageService from "../src/services/package.service";
import logger from "../src/utils/logger";

const packages = [
  {
    code: "A",
    name: "Basic Package",
    price: 15000,
    benefits: [
      "Access to all week events",
      "Event T-shirt",
      "Souvenir booklet",
      "Certificate of participation",
    ],
  },
  {
    code: "B",
    name: "Standard Package",
    price: 25000,
    benefits: [
      "All Basic Package benefits",
      "Event hoodie",
      "Personalized photo frame",
      "Access to VIP lounge",
      "Complimentary meal vouchers",
    ],
  },
  {
    code: "C",
    name: "Premium Package",
    price: 40000,
    benefits: [
      "All Standard Package benefits",
      "Premium gift hamper",
      "Professional photo shoot session",
      "Priority seating at all events",
      "Exclusive after-party access",
      "Commemorative plaque",
    ],
  },
  {
    code: "D",
    name: "Diamond Package",
    price: 60000,
    benefits: [
      "All Premium Package benefits",
      "Luxury gift box",
      "Video montage feature",
      "Reserved VIP parking",
      "Personal event assistant",
      "Lifetime alumni membership",
      "Custom engraved keepsake",
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

    for (const pkg of packages) {
      const created = await packageService.createOrUpdatePackage(
        pkg.code,
        pkg.name,
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
