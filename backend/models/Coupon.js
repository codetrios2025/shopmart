import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountPercentage: { type: Number, required: true, min: 1, max: 100 },
    maxDiscountAmount: { type: Number, default: 500 },
    minOrderAmount: { type: Number, default: 0 },
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Coupon", couponSchema);
