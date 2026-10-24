import mongoose from "mongoose";

const specialDealSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    discountPercentage: { type: Number, required: true, min: 1, max: 99 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

specialDealSchema.index({ product: 1, isActive: 1, startsAt: 1, endsAt: 1 });

export default mongoose.model("SpecialDeal", specialDealSchema);
