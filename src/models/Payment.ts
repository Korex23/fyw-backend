import mongoose, { Schema, Document, Types } from "mongoose";
import { TransactionStatus } from "../types";

export interface IPayment extends Document {
  studentId: Types.ObjectId;
  packageIdAtTime: Types.ObjectId;
  amount: number;
  reference: string;
  status: TransactionStatus;
  paidAt?: Date;
  rawGatewayPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    packageIdAtTime: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    paidAt: {
      type: Date,
    },
    rawGatewayPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
PaymentSchema.index({ studentId: 1, status: 1 });
PaymentSchema.index({ reference: 1 });

export default mongoose.model<IPayment>("Payment", PaymentSchema);
