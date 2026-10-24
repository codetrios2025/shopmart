import crypto from "crypto";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { calculateCouponDiscount } from "../utils/coupon.js";
import {
  isEmailConfigured,
  sendOrderConfirmationEmail,
} from "../utils/email.js";
import {
  getLiveSpecialDeals,
  getSpecialDealPrice,
} from "../utils/specialDeals.js";

const notifyOrderConfirmation = async (order, customer) => {
  if (!isEmailConfigured()) {
    console.warn("SHOPMART SMTP is not configured; order confirmation email was not sent.");
    return false;
  }
  try {
    await sendOrderConfirmationEmail({
      name: customer.name,
      email: customer.email,
      order,
    });
    await Order.updateOne(
      { _id: order._id },
      { $set: { confirmationEmailSentAt: new Date() } },
    );
    return true;
  } catch {
    console.error("SHOPMART order confirmation email delivery failed.");
    return false;
  }
};

const getRazorpayInstance = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  const hasPlaceholder = [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET].some(
    (value) => !value || /replace|your_|example|<.*>/i.test(value),
  );
  if (hasPlaceholder) {
    const error = new Error(
      "Online payments are not configured. Set valid Razorpay test keys in backend/.env and restart the backend.",
    );
    error.statusCode = 503;
    throw error;
  }

  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
};

export const createOrder = async (req, res, next) => {
  try {
    const { items, addressId, couponCode } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }
    if (!mongoose.isValidObjectId(addressId)) {
      return res.status(400).json({ message: "Select a saved delivery address" });
    }
    const customer = await User.findById(req.user._id).select("addresses name email");
    const shippingAddress = customer?.addresses.id(addressId);
    if (!shippingAddress) {
      return res.status(400).json({ message: "The selected delivery address is unavailable" });
    }
    if (
      items.some(
        (item) =>
          !item ||
          !mongoose.isValidObjectId(item.product) ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 ||
          Number(item.quantity) > 99,
      )
    ) {
      return res.status(400).json({ message: "One or more cart items are invalid" });
    }

    const productIds = [...new Set(items.map((item) => String(item.product)))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const activeDeals = await getLiveSpecialDeals(productIds);
    const dealByProduct = new Map(
      activeDeals.map((deal) => [String(deal.product), deal]),
    );

    const orderItems = [];
    for (const item of items) {
      const product = productById.get(String(item.product));
      const quantity = Number(item.quantity);
      if (!product) {
        return res.status(400).json({ message: "A product in your cart is no longer available" });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ message: `${product.title} does not have enough stock` });
      }
      if (product.sizes.length && !product.sizes.includes(item.selectedSize)) {
        return res.status(400).json({
          message: `Select a valid size for ${product.title}`,
        });
      }
      if (product.colors.length && !product.colors.includes(item.selectedColor)) {
        return res.status(400).json({
          message: `Select a valid color for ${product.title}`,
        });
      }
      const activeDeal = dealByProduct.get(String(product._id));
      const colorImages = product.colorImages?.find(
        (group) => group.color === item.selectedColor,
      )?.images;
      const assignedColorImages =
        product.colorImages?.flatMap((group) => group.images || []) || [];
      const sharedImage = product.images.find(
        (image) => !assignedColorImages.includes(image),
      );
      orderItems.push({
        product: product._id,
        title: product.title,
        image:
          colorImages?.[0] ||
          sharedImage ||
          product.images[0],
        price: activeDeal
          ? getSpecialDealPrice(product.price, activeDeal.discountPercentage)
          : product.price,
        quantity,
        selectedSize: item.selectedSize || undefined,
        selectedColor: item.selectedColor || undefined,
        seller: product.seller,
      });
    }

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const deliveryFee = subtotal > 0 && subtotal < 500 ? 50 : 0;
    const { coupon, discountAmount } = await calculateCouponDiscount(
      couponCode,
      subtotal,
    );
    const totalAmount = Math.max(0, subtotal + deliveryFee - discountAmount);
    const freeOrder = totalAmount === 0;
    const razorpayOrder = freeOrder
      ? null
      : await getRazorpayInstance().orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt: `shopmart_${Date.now()}`,
        });
    const order = await Order.create({
      customer: req.user._id,
      items: orderItems,
      shippingAddress: {
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
      },
      subtotal,
      deliveryFee,
      discountAmount,
      couponCode: coupon?.code,
      totalAmount,
      paymentInfo: {
        gateway: freeOrder ? "Coupon" : "Razorpay",
        razorpayOrderId: razorpayOrder?.id,
        status: freeOrder ? "Completed" : "Pending",
      },
    });
    const confirmationEmailSent = freeOrder
      ? await notifyOrderConfirmation(order, customer)
      : false;

    res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
      razorpayOrder,
      freeOrder,
      confirmationEmailSent,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature: signature,
      orderId,
    } = req.body;
    if (![razorpayOrderId, razorpayPaymentId, signature, orderId].every(Boolean)) {
      return res.status(400).json({ message: "Payment verification data is incomplete" });
    }
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    const order = await Order.findOne({
      _id: orderId,
      customer: req.user._id,
      "paymentInfo.razorpayOrderId": razorpayOrderId,
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.paymentInfo.status === "Completed") {
      return res.json({
        success: true,
        order,
        confirmationEmailSent: Boolean(order.confirmationEmailSentAt),
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      const error = new Error("Online payments are not configured");
      error.statusCode = 503;
      throw error;
    }
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest();
    const received = Buffer.from(signature, "hex");
    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment signature validation failed",
      });
    }

    const completedOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        customer: req.user._id,
        "paymentInfo.status": { $ne: "Completed" },
      },
      {
        $set: {
          "paymentInfo.razorpayPaymentId": razorpayPaymentId,
          "paymentInfo.status": "Completed",
        },
      },
      { new: true },
    );
    if (!completedOrder) {
      const alreadyCompleted = await Order.findOne({
        _id: order._id,
        customer: req.user._id,
        "paymentInfo.status": "Completed",
      });
      return res.json({
        success: true,
        message: "Payment verified",
        order: alreadyCompleted,
        confirmationEmailSent: Boolean(alreadyCompleted?.confirmationEmailSentAt),
      });
    }

    const customer = await User.findById(req.user._id).select("-password");
    const confirmationEmailSent = customer
      ? await notifyOrderConfirmation(completedOrder, customer)
      : false;
    res.json({
      success: true,
      message: "Payment verified",
      order: completedOrder,
      confirmationEmailSent,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerOrders = async (req, res, next) => {
  try {
    const query = Order.find({ customer: req.user._id })
      .populate("items.product", "title images")
      .sort({ createdAt: -1, _id: -1 });
    if (req.query.page === undefined) {
      return res.json(await query);
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const [orders, total] = await Promise.all([
      query.skip((page - 1) * limit).limit(limit),
      Order.countDocuments({ customer: req.user._id }),
    ]);
    res.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getSellerOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const filter = { items: { $elemMatch: { seller: req.user._id } } };
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customer", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
    ]);
    res.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
