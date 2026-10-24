import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    eyebrow: { type: String, required: true, trim: true, maxlength: 32 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 180, default: "" },
    buttonLabel: { type: String, required: true, trim: true, maxlength: 24 },
    link: { type: String, required: true, trim: true, maxlength: 200 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    imageAlt: { type: String, required: true, trim: true, maxlength: 120 },
    placement: {
      type: String,
      enum: ["main", "side"],
      required: true,
      default: "side",
    },
    theme: {
      type: String,
      enum: ["indigo", "blue", "rose", "amber", "emerald"],
      required: true,
      default: "blue",
    },
    sortOrder: { type: Number, min: 0, max: 100, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Banner", bannerSchema);
