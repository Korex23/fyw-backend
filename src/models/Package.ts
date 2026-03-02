import mongoose, { Schema, Document } from "mongoose";

export interface IPackage extends Document {
  code: string;
  name: string;
  packageType: "FULL" | "TWO_DAY" | "CORPORATE_OWAMBE" | "CORPORATE_PLUS";
  price: number;
  benefits: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PackageSchema = new Schema<IPackage>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    packageType: {
      type: String,
      required: true,
      enum: ["FULL", "TWO_DAY", "CORPORATE_OWAMBE", "CORPORATE_PLUS"],
      default: "FULL",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    benefits: {
      type: [String],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IPackage>("Package", PackageSchema);
