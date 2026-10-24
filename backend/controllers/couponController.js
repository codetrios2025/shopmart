import {
  calculateCouponDiscount,
  getAvailableCoupons,
} from "../utils/coupon.js";

export const getActiveCoupons = async (req, res, next) => {
  try {
    res.json(await getAvailableCoupons());
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req, res, next) => {
  try {
    const { code } = req.body;
    const subtotal = Number(req.body.subtotal);
    if (!code || !Number.isFinite(subtotal) || subtotal <= 0) {
      return res.status(400).json({ message: "A coupon code and valid subtotal are required" });
    }

    const { coupon, discountAmount } = await calculateCouponDiscount(code, subtotal);
    res.json({
      code: coupon.code,
      discountAmount,
      finalSubtotal: Math.max(0, subtotal - discountAmount),
    });
  } catch (error) {
    next(error);
  }
};
