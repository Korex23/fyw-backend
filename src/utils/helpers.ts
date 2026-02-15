import crypto from "crypto";

export const generateReference = (): string => {
  return `FYW-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

export const formatCurrency = (amount: number): string => {
  return `₦${(amount / 100).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
};

export const verifyPaystackSignature = (
  payload: string,
  signature: string,
  secret: string,
): boolean => {
  const hash = crypto
    .createHmac("sha512", secret)
    .update(payload)
    .digest("hex");
  return hash === signature;
};

export const calculateOutstanding = (
  packagePrice: number,
  totalPaid: number,
): number => {
  const outstanding = packagePrice - totalPaid;
  return outstanding > 0 ? outstanding : 0;
};
