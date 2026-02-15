import mongoose, { Schema, Document } from "mongoose";

export interface IWebhookEvent extends Document {
  eventId: string;
  reference: string;
  event: string;
  processedAt: Date;
  rawPayload: any;
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    reference: {
      type: String,
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index to prevent duplicate processing
WebhookEventSchema.index({ eventId: 1, reference: 1 }, { unique: true });

export default mongoose.model<IWebhookEvent>(
  "WebhookEvent",
  WebhookEventSchema,
);
