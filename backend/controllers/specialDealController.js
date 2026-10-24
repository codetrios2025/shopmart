import mongoose from "mongoose";
import Product from "../models/Product.js";
import SpecialDeal from "../models/SpecialDeal.js";
import {
  applySpecialDealPricing,
  getLiveSpecialDeals,
} from "../utils/specialDeals.js";

const validateDealInput = (body) => {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const productId = String(body.product || "");
  const discountPercentage = Number(body.discountPercentage);
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);

  if (!title || title.length > 80) {
    return { error: "Deal title is required and must be 80 characters or fewer." };
  }
  if (!mongoose.isValidObjectId(productId)) {
    return { error: "Select a valid product for this deal." };
  }
  if (
    !Number.isFinite(discountPercentage) ||
    discountPercentage < 1 ||
    discountPercentage > 99
  ) {
    return { error: "Deal discount must be between 1% and 99%." };
  }
  if (
    !body.startsAt ||
    !body.endsAt ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return { error: "Choose a valid start and end date; the end must be after the start." };
  }
  return {
    value: {
      title,
      product: productId,
      discountPercentage,
      startsAt,
      endsAt,
      isActive: body.isActive !== false,
    },
  };
};

const hasScheduleConflict = async (deal, excludeId) => {
  if (!deal.isActive) return false;
  const query = {
    product: deal.product,
    isActive: true,
    startsAt: { $lt: deal.endsAt },
    endsAt: { $gt: deal.startsAt },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Boolean(await SpecialDeal.exists(query));
};

export const getPublicSpecialDeals = async (req, res, next) => {
  try {
    const now = new Date();
    const deals = await SpecialDeal.find({
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gt: now },
    })
      .populate({
        path: "product",
        match: { stock: { $gt: 0 } },
        populate: { path: "seller", select: "name" },
      })
      .sort({ endsAt: 1 })
      .limit(12);
    res.json(
      deals
        .filter((deal) => deal.product)
        .map((deal) => ({
          ...deal.toObject(),
          product: applySpecialDealPricing(deal.product, deal),
        })),
    );
  } catch (error) {
    next(error);
  }
};

export const getAdminSpecialDeals = async (req, res, next) => {
  try {
    const deals = await SpecialDeal.find()
      .populate("product", "title brand price originalPrice images stock")
      .sort({ createdAt: -1 });
    res.json(deals);
  } catch (error) {
    next(error);
  }
};

export const createSpecialDeal = async (req, res, next) => {
  try {
    const { value, error } = validateDealInput(req.body || {});
    if (error) return res.status(400).json({ message: error });
    if (!(await Product.exists({ _id: value.product }))) {
      return res.status(404).json({ message: "The selected product was not found." });
    }
    if (await hasScheduleConflict(value)) {
      return res.status(409).json({
        message: "This product already has an active deal during that date range.",
      });
    }
    const deal = await SpecialDeal.create(value);
    await deal.populate("product", "title brand price originalPrice images stock");
    res.status(201).json(deal);
  } catch (error) {
    next(error);
  }
};

export const updateSpecialDeal = async (req, res, next) => {
  try {
    const deal = await SpecialDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Special deal not found." });
    const { value, error } = validateDealInput(req.body || {});
    if (error) return res.status(400).json({ message: error });
    if (!(await Product.exists({ _id: value.product }))) {
      return res.status(404).json({ message: "The selected product was not found." });
    }
    if (await hasScheduleConflict(value, deal._id)) {
      return res.status(409).json({
        message: "This product already has an active deal during that date range.",
      });
    }
    Object.assign(deal, value);
    await deal.save();
    await deal.populate("product", "title brand price originalPrice images stock");
    res.json(deal);
  } catch (error) {
    next(error);
  }
};

export const toggleSpecialDeal = async (req, res, next) => {
  try {
    const deal = await SpecialDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Special deal not found." });
    if (!deal.isActive) {
      if (await hasScheduleConflict({ ...deal.toObject(), isActive: true }, deal._id)) {
        return res.status(409).json({
          message: "This product already has an active deal during that date range.",
        });
      }
      deal.isActive = true;
    } else {
      deal.isActive = false;
    }
    await deal.save();
    await deal.populate("product", "title brand price originalPrice images stock");
    res.json(deal);
  } catch (error) {
    next(error);
  }
};

export const deleteSpecialDeal = async (req, res, next) => {
  try {
    const deal = await SpecialDeal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ message: "Special deal not found." });
    res.json({ message: "Special deal deleted." });
  } catch (error) {
    next(error);
  }
};
