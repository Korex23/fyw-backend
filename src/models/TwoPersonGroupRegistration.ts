import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITwoPersonGroupMember {
  studentId: Types.ObjectId;
  fullName: string;
  matricNumber: string;
  email?: string;
}

export interface ITwoPersonGroupRegistration extends Document {
  members: ITwoPersonGroupMember[];
  payerEmail: string;
  totalAmount: number;
  totalPaid: number;
  paymentStatus: "NOT_PAID" | "PARTIALLY_PAID" | "FULLY_PAID";
  createdAt: Date;
  updatedAt: Date;
}

const TwoPersonGroupMemberSchema = new Schema<ITwoPersonGroupMember>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    fullName: { type: String, required: true, trim: true },
    matricNumber: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const TwoPersonGroupRegistrationSchema =
  new Schema<ITwoPersonGroupRegistration>(
    {
      members: {
        type: [TwoPersonGroupMemberSchema],
        required: true,
        validate: {
          validator: (v: ITwoPersonGroupMember[]) => v.length === 2,
          message: "A two-person group must have exactly 2 members",
        },
      },
      payerEmail: { type: String, required: true, trim: true, lowercase: true },
      totalAmount: { type: Number, required: true, min: 0 },
      totalPaid: { type: Number, required: true, default: 0, min: 0 },
      paymentStatus: {
        type: String,
        enum: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID"],
        default: "NOT_PAID",
      },
    },
    { timestamps: true },
  );

TwoPersonGroupRegistrationSchema.index({ paymentStatus: 1 });

export default mongoose.model<ITwoPersonGroupRegistration>(
  "TwoPersonGroupRegistration",
  TwoPersonGroupRegistrationSchema,
);
