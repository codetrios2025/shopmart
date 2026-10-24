import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import ProductReview from "../models/ProductReview.js";

export const getProductReviews = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    const product = await Product.findById(req.params.id).select("_id");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const [reviews, total] = await Promise.all([
      ProductReview.find({ product: product._id })
        .populate("customer", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments({ product: product._id }),
    ]);
    res.json({
      reviews: reviews.map((review) => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerName: review.customer?.name || "Verified customer",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const createProductReview = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    const product = await Product.findById(req.params.id).select("_id");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === "string" ? req.body.comment.trim() : "";
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be a whole number from 1 to 5" });
    }
    if (comment.length < 10 || comment.length > 1000) {
      return res.status(400).json({ message: "Review must be between 10 and 1000 characters" });
    }

    const verifiedPurchase = await Order.exists({
      customer: req.user._id,
      orderStatus: { $ne: "Cancelled" },
      "paymentInfo.status": "Completed",
      "items.product": product._id,
    });
    if (!verifiedPurchase) {
      return res.status(403).json({
        message: "Only customers who completed a purchase can review this product.",
      });
    }

    const review = await ProductReview.create({
      product: product._id,
      customer: req.user._id,
      rating,
      comment,
    });
    const [summary] = await ProductReview.aggregate([
      { $match: { product: product._id } },
      {
        $group: {
          _id: "$product",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
        },
      },
    ]);
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          rating: Math.round(summary.averageRating * 10) / 10,
          numReviews: summary.reviewCount,
        },
      },
    );

    await review.populate("customer", "name");
    res.status(201).json({
      review: {
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerName: review.customer?.name || "Verified customer",
      },
      rating: Math.round(summary.averageRating * 10) / 10,
      numReviews: summary.reviewCount,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "You have already reviewed this product." });
    }
    next(error);
  }
};
