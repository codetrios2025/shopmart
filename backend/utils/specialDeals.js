import SpecialDeal from "../models/SpecialDeal.js";

export const getLiveSpecialDeals = (productIds, now = new Date()) => {
  if (!productIds.length) return Promise.resolve([]);
  return SpecialDeal.find({
    product: { $in: productIds },
    isActive: true,
    startsAt: { $lte: now },
    endsAt: { $gt: now },
  }).sort({ createdAt: -1 });
};

export const getSpecialDealPrice = (price, discountPercentage) =>
  Number((Number(price) * (1 - Number(discountPercentage) / 100)).toFixed(2));

export const applySpecialDealPricing = (product, deal) => {
  if (!deal) return product;
  const result = typeof product.toObject === "function" ? product.toObject() : { ...product };
  result.dealPrice = getSpecialDealPrice(result.price, deal.discountPercentage);
  result.activeSpecialDeal = {
    _id: deal._id,
    title: deal.title,
    discountPercentage: deal.discountPercentage,
    endsAt: deal.endsAt,
  };
  return result;
};
