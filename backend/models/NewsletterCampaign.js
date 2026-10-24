import mongoose from "mongoose";

const newsletterCampaignSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, trim: true, maxlength: 5000, default: "" },
    banner: {
      title: { type: String, trim: true, maxlength: 80 },
      description: { type: String, trim: true, maxlength: 180 },
      buttonLabel: { type: String, trim: true, maxlength: 24 },
      link: { type: String, trim: true, maxlength: 200 },
      imageUrl: { type: String, trim: true, maxlength: 2048 },
      imageAlt: { type: String, trim: true, maxlength: 120 },
    },
    status: {
      type: String,
      enum: ["queued", "sending", "sent", "partial", "failed"],
      default: "queued",
      index: true,
    },
    audienceCount: { type: Number, default: 0 },
    processedCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    lastError: { type: String, maxlength: 240 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model("NewsletterCampaign", newsletterCampaignSchema);
