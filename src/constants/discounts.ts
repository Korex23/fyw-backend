import { IPackage } from "../models/Package";

// Matric numbers that receive a ₦15,000 discount on the ₦60,000 FULL package
export const FULL_PACKAGE_DISCOUNT_MATRICS = new Set([
  "190410008",
  "180802074",
  "190403054",
  "210401521",
  "190408047",
  "190407080",
  "190409027",
  "190405021",
  "210408505",
  "190407084",
  "210403510",
  "210402504",
  "210401514",
  "190402002",
  "190406042",
  "190406023",
  "190404002",
  "190402059",
  "210409525",
  "190409002",
  "190404009",
  "190408025",
  "210407507",
]);

export const FULL_PACKAGE_DISCOUNT_AMOUNT = 15000;

/**
 * Returns the effective price a student must pay for a given package,
 * applying any applicable discounts based on their matric number.
 */
export function getEffectivePrice(matricNumber: string, pkg: IPackage): number {
  if (
    pkg.packageType === "FULL" &&
    FULL_PACKAGE_DISCOUNT_MATRICS.has(matricNumber.toUpperCase())
  ) {
    return pkg.price - FULL_PACKAGE_DISCOUNT_AMOUNT;
  }
  return pkg.price;
}
