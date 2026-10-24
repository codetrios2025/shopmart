import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, default: "T-Shirts" },
    brand: { type: String, required: true },
    price: { type: Number, required: true, min: 0.01 },
    originalPrice: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator(value) {
          return value >= this.price;
        },
        message: "Original price cannot be lower than the selling price",
      },
    },
    specialDiscountPercentage: { type: Number, default: 0, min: 0, max: 99 },
    discountPercentage: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    images: [{ type: String, required: true }],
    sizes: [{ type: String }],
    colors: [{ type: String }],
    colorImages: [
      {
        _id: false,
        color: { type: String, required: true },
        images: [{ type: String }],
      },
    ],
    description: { type: String, required: true },
    specifications: {
      fabric: { type: String, default: "100% Cotton" },
      fit: { type: String, default: "Regular Fit" },
      pattern: { type: String, default: "Solid" },
      sleeve: { type: String, default: "Half Sleeve" },
      care: { type: String, default: "Machine wash" },
    },
    stock: {
      type: Number,
      required: true,
      default: 10,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number",
      },
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, result) {
        result.discountPercentage =
          result.originalPrice > result.price
            ? Math.max(
                1,
                Math.round((1 - result.price / result.originalPrice) * 100),
              )
            : 0;
        return result;
      },
    },
  },
);

productSchema.pre("validate", function calculateDiscount() {
  if (this.specialDiscountPercentage > 0 && this.originalPrice > 0) {
    this.price = Number(
      (this.originalPrice * (1 - this.specialDiscountPercentage / 100)).toFixed(2),
    );
  }
  this.discountPercentage =
    this.originalPrice > this.price
      ? Math.max(1, Math.round((1 - this.price / this.originalPrice) * 100))
      : 0;
});

export default mongoose.model("Product", productSchema);
