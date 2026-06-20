import { IPackage } from "../models/Package";

// Matric numbers that receive a ₦15,000 discount on the ₦60,000 FULL package
export const FULL_PACKAGE_DISCOUNT_MATRICS = new Set([
  "190408025",
  "190408026",
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
