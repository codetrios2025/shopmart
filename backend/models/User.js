import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const addressSchema = new mongoose.Schema({
  type: { type: String, enum: ["Home", "Work"], default: "Home" },
  street: { type: String, required: true, trim: true, maxlength: 200 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  state: { type: String, required: true, trim: true, maxlength: 80 },
  pincode: { type: String, required: true, trim: true, maxlength: 12 },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    googleId: { type: String, unique: true, sparse: true, select: false },
    phone: { type: String },
    profileImage: { type: String, trim: true, maxlength: 2048, default: "" },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "seller", "admin"],
      default: "customer",
    },
    sellerCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    sellerApproved: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true },
);

userSchema.pre("validate", function () {
  if (this.role === "seller" && !this.sellerCode) {
    this.sellerCode = `SM-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
  }
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
