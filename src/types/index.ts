import { Request } from "express";

export enum PaymentStatus {
  NOT_PAID = "NOT_PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  FULLY_PAID = "FULLY_PAID",
  // Student attends on a fully-sponsored basis — no payment is collected but
  // they receive full access and an invite, same as a FULLY_PAID student.
  SPONSORSHIP = "SPONSORSHIP",
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
  imageUrl: string;
  generatedAt: Date;
}

export interface DayBreakdownEntry {
  day: string;
  label: string;
  startedCount: number;
  fullyPaidCount: number;
}

export interface StudentMetrics {
  totalStudents: number;
  totalRevenue: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  notPaidCount: number;
  outstandingTotal: number;
  // Outstanding owed only by people who have already started paying.
  startedPayersOutstanding: number;
  // totalRevenue + startedPayersOutstanding.
  projectedRevenueIfStartedComplete: number;
  dayBreakdown: DayBreakdownEntry[];
}
