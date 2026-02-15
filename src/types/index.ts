import { Request } from "express";

export enum PaymentStatus {
  NOT_PAID = "NOT_PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  FULLY_PAID = "FULLY_PAID",
}

export enum TransactionStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
}

export interface AdminPayload {
  id: string;
  email: string;
}

export interface AuthRequest extends Request {
  admin?: AdminPayload;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    paid_at: string;
    metadata: {
      studentId: string;
      matricNumber: string;
      packageCode: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    paid_at: string;
    metadata: {
      studentId: string;
      matricNumber: string;
      packageCode: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface InviteData {
  pdfUrl: string;
  imageUrl: string;
  generatedAt: Date;
}

export interface StudentMetrics {
  totalStudents: number;
  totalRevenue: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  notPaidCount: number;
  outstandingTotal: number;
}
