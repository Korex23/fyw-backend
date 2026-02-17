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

export interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data: {
    link: string;
    [key: string]: any;
  };
}

export interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: {
    id?: number;
    tx_ref?: string;
    flw_ref?: string;
    status: string;
    amount: number;
    paid_at?: string;
    created_at?: string;
    reference?: string;
    [key: string]: any;
  };
}

export interface FlutterwaveWebhookEvent {
  event?: string;
  data: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    reference?: string;
    amount?: number;
    created_at?: string;
    paid_at?: string;
    meta?: {
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
