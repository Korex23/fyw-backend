import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGroupMember {
  studentId: Types.ObjectId;
  fullName: string;
  matricNumber: string;
  email?: string;
}

export interface IGroupRegistration extends Document {
  members: IGroupMember[];
  payerEmail: string;
  totalAmount: number;
  totalPaid: number;
  paymentStatus: "NOT_PAID" | "PARTIALLY_PAID" | "FULLY_PAID";
  createdAt: Date;
  updatedAt: Date;
}

const GroupMemberSchema = new Schema<IGroupMember>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    fullName: { type: String, required: true, trim: true },
    matricNumber: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const GroupRegistrationSchema = new Schema<IGroupRegistration>(
  {
    members: {
      type: [GroupMemberSchema],
      required: true,
      validate: {
        validator: (v: IGroupMember[]) => v.length === 3,
        message: "A group must have exactly 3 members",
      },
    },
    payerEmail: { type: String, required: true, trim: true, lowercase: true },
    totalAmount: { type: Number, required: true, default: 150000 },
    totalPaid: { type: Number, required: true, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID"],
      default: "NOT_PAID",
    },
  },
  { timestamps: true },
);

GroupRegistrationSchema.index({ paymentStatus: 1 });

export default mongoose.model<IGroupRegistration>(
  "GroupRegistration",
  GroupRegistrationSchema,
);
