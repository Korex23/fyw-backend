import crypto from "crypto";

export const generateReference = (): string => {
  return `FYW-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

export const formatCurrency = (amount: number): string => {
  return `₦${(amount / 100).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
};

export const verifyFlutterwaveSignature = (
  signature: string,
  secretHash: string,
): boolean => {
  return signature === secretHash;
};

export const calculateOutstanding = (
  packagePrice: number,
  totalPaid: number,
): number => {
  const outstanding = packagePrice - totalPaid;
  return outstanding > 0 ? outstanding : 0;
};
