import Coupon from "../models/Coupon.js";

export function isCouponCurrentlyValid(coupon, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const today = `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}-${parts.find((part) => part.type === "day").value}`;
  const startDate = coupon.startDate?.toISOString().slice(0, 10);
  const expiryDate = coupon.expiryDate.toISOString().slice(0, 10);
  return (!startDate || today >= startDate) && today <= expiryDate;
}

export async function getAvailableCoupons() {
  const coupons = await Coupon.find({ isActive: true })
    .select(
      "code discountPercentage maxDiscountAmount minOrderAmount startDate expiryDate",
    )
    .sort({ discountPercentage: -1, createdAt: -1 })
    .lean();
  return coupons.filter(isCouponCurrentlyValid);
}

export async function calculateCouponDiscount(code, subtotal) {
  if (!code) return { coupon: null, discountAmount: 0 };

  const coupon = await Coupon.findOne({
    code: String(code).trim().toUpperCase(),
    isActive: true,
  });
  if (!coupon) {
    const error = new Error("Coupon is invalid or inactive");
    error.statusCode = 400;
    throw error;
  }
  if (!isCouponCurrentlyValid(coupon)) {
    const error = new Error("This coupon is not currently valid");
    error.statusCode = 400;
    throw error;
  }
  if (subtotal < coupon.minOrderAmount) {
    const error = new Error(
      `This coupon requires a minimum order of ₹${coupon.minOrderAmount}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    coupon,
    discountAmount: Math.min(
      Math.round((subtotal * coupon.discountPercentage) / 100),
      coupon.maxDiscountAmount,
    ),
  };
}
