import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";

const parseAddress = (body) => {
  if (body.type !== undefined && !["Home", "Work"].includes(body.type)) {
    return { error: "Address label must be Home or Work" };
  }
  const type = body.type === "Work" ? "Work" : "Home";
  const address = { type };
  for (const [field, maximum] of Object.entries({
    street: 200,
    city: 80,
    state: 80,
    pincode: 12,
  })) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return { error: `${field} is required` };
    }
    address[field] = body[field].trim();
    if (address[field].length > maximum) {
      return { error: `${field} must be ${maximum} characters or fewer` };
    }
  }
  if (!/^[A-Za-z0-9 -]{4,12}$/.test(address.pincode)) {
    return { error: "Enter a valid postal or PIN code" };
  }
  return { address };
};

export const getAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    res.json(user.addresses);
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    if (user.addresses.length >= 10) {
      return res.status(400).json({ message: "You can save up to 10 addresses" });
    }
    const result = parseAddress(req.body || {});
    if (result.error) return res.status(400).json({ message: result.error });
    const isDefault =
      user.addresses.length === 0 || req.body.isDefault === true;
    if (isDefault) user.addresses.forEach((address) => (address.isDefault = false));
    user.addresses.push({ ...result.address, isDefault });
    await user.save();
    res.status(201).json(user.addresses[user.addresses.length - 1]);
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid address id" });
    }
    const user = await User.findById(req.user._id).select("addresses");
    const address = user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });
    const wasDefault = address.isDefault;
    address.deleteOne();
    if (wasDefault && user.addresses.length) {
      user.addresses[0].isDefault = true;
    }
    await user.save();
    res.json({ message: "Address deleted", addresses: user.addresses });
  } catch (error) {
    next(error);
  }
};

export const getWishlist = async (req, res, next) => {
  try {
      const pageProvided = req.query.page !== undefined;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
      const userQuery = User.findById(req.user._id).select("wishlist");
      const user = await userQuery.populate({
        path: "wishlist",
        populate: { path: "seller", select: "name" },
        ...(pageProvided && {
          options: { sort: { _id: -1 }, skip: (page - 1) * limit, limit },
        }),
      });
      const wishlist = user.wishlist.filter(Boolean);
      if (!pageProvided && wishlist.length !== user.wishlist.length) {
        await User.updateOne(
          { _id: user._id },
          { $set: { wishlist: wishlist.map((product) => product._id) } },
        );
      }
      if (!pageProvided) return res.json(wishlist);
      const total = await User.findById(req.user._id).select("wishlist").lean();
      res.json({
        wishlist,
        pagination: {
          page,
          limit,
          total: total?.wishlist?.length || 0,
          totalPages: Math.ceil((total?.wishlist?.length || 0) / limit),
        },
      });
  } catch (error) {
    next(error);
  }
};

export const addWishlistItem = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    const product = await Product.findById(req.params.productId).select("_id");
    if (!product) return res.status(404).json({ message: "Product not found" });
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { wishlist: product._id } },
    );
    res.json({ message: "Product added to wishlist", productId: product._id });
  } catch (error) {
    next(error);
  }
};

export const removeWishlistItem = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.productId)) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { wishlist: req.params.productId } },
    );
    res.json({ message: "Product removed from wishlist" });
  } catch (error) {
    next(error);
  }
};
