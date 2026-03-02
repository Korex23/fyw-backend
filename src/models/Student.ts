import mongoose, { Schema, Document, Types } from "mongoose";
import { PaymentStatus } from "../types";
import { EVENT_DAY_KEYS, EventDayKey } from "../constants/eventDays";

export interface IStudent extends Document {
  fullName: string;
  matricNumber: string;
  gender?: "male" | "female";
  email?: string;
  phone?: string;
  department?: string;
  packageId: Types.ObjectId;
  selectedDays: EventDayKey[];
  totalPaid: number;
  paymentStatus: PaymentStatus;
  invites?: {
    imageUrl?: string;
    generatedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    matricNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    department: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    selectedDays: {
      type: [String],
      enum: EVENT_DAY_KEYS,
      default: [],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.NOT_PAID,
    },
    invites: {
      imageUrl: String,
      generatedAt: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient queries
StudentSchema.index({ paymentStatus: 1 });
StudentSchema.index({ packageId: 1 });

export default mongoose.model<IStudent>("Student", StudentSchema);
