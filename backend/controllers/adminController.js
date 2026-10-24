import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Category from "../models/Category.js";
import Coupon from "../models/Coupon.js";
import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { productImageUploadDirectory } from "../middleware/productImageUpload.js";
import { normalizeColorImageSelections } from "../utils/productImages.js";

// --- DASHBOARD OVERVIEW ---
export const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: "customer" });
    const totalSellers = await User.countDocuments({ role: "seller" });
    const [orderSummary, recentOrders] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentInfo.status", "Completed"] },
                  "$totalAmount",
                  0,
                ],
              },
            },
            Delivered: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Delivered"] }, 1, 0] },
            },
            Shipped: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Shipped"] }, 1, 0] },
            },
            Processing: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Processing"] }, 1, 0] },
            },
            Cancelled: {
              $sum: { $cond: [{ $eq: ["$orderStatus", "Cancelled"] }, 1, 0] },
            },
          },
        },
      ]),
      Order.find()
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .limit(6),
    ]);
    const {
      totalOrders = 0,
      totalRevenue = 0,
      Delivered = 0,
      Shipped = 0,
      Processing = 0,
      Cancelled = 0,
    } = orderSummary[0] || {};

    res.json({
      metrics: { totalUsers, totalSellers, totalOrders, totalRevenue },
      orderStatusCounts: { Delivered, Shipped, Processing, Cancelled },
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

// --- USER MANAGEMENT ---
const getAdminAccounts = async (role, req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const search = String(req.query.search || "").trim();
    const sortOptions = {
      newest: { createdAt: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
      "name-asc": { name: 1, _id: 1 },
      "name-desc": { name: -1, _id: -1 },
      "email-asc": { email: 1, _id: 1 },
      "email-desc": { email: -1, _id: -1 },
    };
    const sort = sortOptions[String(req.query.sort)] || sortOptions.newest;
    const query = { role };
    if (search) {
      const expression = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [{ name: expression }, { email: expression }];
      if (role === "seller") query.$or.push({ sellerCode: expression });
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -tokenVersion")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);
    res.json({
      users: users.map((user) => ({
        ...user,
        isActive: user.isActive !== false,
        ...(role === "seller" && {
          sellerApproved: user.sellerApproved !== false,
        }),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const normalizeProductOptions = (value) => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = value.split(",");
    }
  }
  if (!Array.isArray(value)) {
    const error = new Error("Sizes and colors must be lists");
    error.statusCode = 400;
    throw error;
  }
  const options = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (options.length > 30 || options.some((item) => item.length > 40)) {
    const error = new Error(
      "Each product can have up to 30 sizes or colors (40 characters each)",
    );
    error.statusCode = 400;
    throw error;
  }
  return options;
};

export const getAllUsers = (req, res, next) =>
  getAdminAccounts("customer", req, res, next);

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin" || String(user._id) === String(req.user._id)) {
      return res.status(403).json({ message: "This account cannot be removed" });
    }
    await user.deleteOne();
    res.json({ message: "User removed successfully" });
  } catch (error) {
    next(error);
  }
};

// --- SELLER MANAGEMENT ---
export const getAllSellers = async (req, res, next) => {
  return getAdminAccounts("seller", req, res, next);
};

export const approveSeller = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid seller id" });
    }
    const seller = await User.findOne({
      _id: req.params.id,
      role: "seller",
    });
    if (!seller) return res.status(404).json({ message: "Seller not found" });
    seller.sellerApproved = true;
    await seller.save();
    const safeSeller = seller.toObject();
    delete safeSeller.password;
    delete safeSeller.tokenVersion;
    res.json({
      message: "Seller approved successfully",
      user: safeSeller,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ message: "Choose an active or inactive status" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin" || String(user._id) === String(req.user._id)) {
      return res.status(403).json({ message: "This account status cannot be changed" });
    }
    user.isActive = req.body.isActive;
    user.tokenVersion += 1;
    await user.save();
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.tokenVersion;
    res.json({
      message: `Account ${user.isActive ? "activated" : "deactivated"} successfully`,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

// --- PRODUCT MANAGEMENT ---
export const getAllAdminProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10),
    );
    const query = {};
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const stock = String(req.query.stock || "");
    const minPrice =
      req.query.minPrice === undefined || req.query.minPrice === ""
        ? undefined
        : Number(req.query.minPrice);
    const maxPrice =
      req.query.maxPrice === undefined || req.query.maxPrice === ""
        ? undefined
        : Number(req.query.maxPrice);
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "price-asc": { price: 1, _id: 1 },
      "price-desc": { price: -1, _id: 1 },
      "name-asc": { title: 1, _id: 1 },
      "name-desc": { title: -1, _id: 1 },
    };
    const sort = sortOptions[String(req.query.sort)] || sortOptions.newest;

    if (search) {
      const expression = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [{ title: expression }, { brand: expression }];
    }
    if (category) query.category = category;
    if (stock === "in") query.stock = { $gt: 0 };
    if (stock === "out") query.stock = 0;
    if (
      (minPrice !== undefined && (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
    ) {
      return res.status(400).json({ message: "Invalid product price range" });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = minPrice;
      if (maxPrice !== undefined) query.price.$lte = maxPrice;
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("seller", "name email")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(query),
    ]);
    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const bulkCreateAdminProducts = async (req, res, next) => {
  try {
    const rowError = (message) => {
      const error = new Error(message);
      error.isImportValidationError = true;
      return error;
    };
    const { products } = req.body || {};
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Provide at least one product to import." });
    }
    if (products.length > 100) {
      return res.status(400).json({ message: "Import up to 100 products at a time." });
    }

    const createdProducts = [];
    const errors = [];
    for (const [index, row] of products.entries()) {
      const rowNumber =
        Number.isInteger(Number(row?.rowNumber)) && Number(row.rowNumber) >= 2
          ? Number(row.rowNumber)
          : index + 2;
      try {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          throw rowError("Product row is invalid.");
        }
        const requiredFields = ["title", "category", "brand", "description"];
        const missingField = requiredFields.find(
          (field) => typeof row[field] !== "string" || !row[field].trim(),
        );
        if (missingField) throw rowError(`${missingField} is required.`);

        const originalPrice = Number(row.originalPrice);
        const specialDiscountPercentage = Number(
          row.specialDiscountPercentage || 0,
        );
        const stock = Number(row.stock);
        const price =
          specialDiscountPercentage > 0
            ? Number(
                (
                  originalPrice *
                  (1 - specialDiscountPercentage / 100)
                ).toFixed(2),
              )
            : Number(row.price);
        if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
          throw rowError("Original price must be greater than zero.");
        }
        if (
          !Number.isFinite(specialDiscountPercentage) ||
          specialDiscountPercentage < 0 ||
          specialDiscountPercentage > 99
        ) {
          throw rowError("Special deal discount must be between 0% and 99%.");
        }
        if (!Number.isFinite(price) || price <= 0 || price > originalPrice) {
          throw rowError("Selling price must be greater than zero and no more than the original price.");
        }
        if (
          row.stock === undefined ||
          String(row.stock).trim() === "" ||
          !Number.isInteger(stock) ||
          stock < 0
        ) {
          throw rowError("Stock must be a whole number of zero or more.");
        }
        if (!Array.isArray(row.images) || row.images.length === 0 || row.images.length > 6) {
          throw rowError("Provide between 1 and 6 image URLs.");
        }
        const images = row.images.map((image) => {
          if (typeof image !== "string" || image.length > 2048) {
            throw rowError("Each product image must be a valid image URL.");
          }
          let imageUrl;
          try {
            imageUrl = new URL(image);
          } catch {
            throw rowError("Each product image must be an absolute http(s) URL.");
          }
          if (!["http:", "https:"].includes(imageUrl.protocol)) {
            throw rowError("Each product image must be an absolute http(s) URL.");
          }
          return image;
        });
        const normalizeOptions = (value, field) => {
          if (!Array.isArray(value) || value.some((option) => typeof option !== "string")) {
            throw rowError(`${field} must be a list of values.`);
          }
          const options = [...new Set(value.map((option) => option.trim()).filter(Boolean))];
          if (options.length > 30 || options.some((option) => option.length > 40)) {
            throw rowError(`${field} can contain up to 30 values of 40 characters each.`);
          }
          return options;
        };

        const product = new Product({
          title: row.title.trim(),
          category: row.category.trim(),
          brand: row.brand.trim(),
          description: row.description.trim(),
          price,
          originalPrice,
          specialDiscountPercentage,
          stock,
          sizes: normalizeOptions(row.sizes || [], "Sizes"),
          colors: normalizeOptions(row.colors || [], "Colors"),
          colorImages: normalizeColorImageSelections(
            row.colorImageSelections,
            images,
            normalizeOptions(row.colors || [], "Colors"),
          ),
          images,
          seller: req.user._id,
        });
        await product.save();
        createdProducts.push(product._id);
      } catch (error) {
        if (
          !error.isImportValidationError &&
          error.statusCode !== 400 &&
          error.name !== "ValidationError" &&
          error.name !== "CastError"
        ) {
          throw error;
        }
        errors.push({ row: rowNumber, message: error.message });
      }
    }

    res.json({
      totalCount: products.length,
      createdCount: createdProducts.length,
      errors,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminProduct = async (req, res, next) => {
  const uploadedFiles = req.files || [];
  const removeUploadedFiles = async () =>
    Promise.all(
      uploadedFiles.map((file) =>
        fs.unlink(path.join(productImageUploadDirectory, file.filename)).catch(
          (cleanupError) => {
            if (cleanupError.code !== "ENOENT") throw cleanupError;
          },
        ),
      ),
    );
  try {
    const body = req.body || {};
    const product = await Product.findById(req.params.id);
    if (!product) {
      await removeUploadedFiles();
      return res.status(404).json({ message: "Product not found" });
    }

    let retainedImages;
    try {
      retainedImages = JSON.parse(body.retainedImages || "[]");
    } catch {
      await removeUploadedFiles();
      return res.status(400).json({ message: "Product image selection is invalid" });
    }
    if (
      !Array.isArray(retainedImages) ||
      retainedImages.some(
        (image) => typeof image !== "string" || !product.images.includes(image),
      )
    ) {
      await removeUploadedFiles();
      return res.status(400).json({ message: "Product image selection is invalid" });
    }

    const uploadedImageUrls = uploadedFiles.map(
      (file) =>
        `${req.protocol}://${req.get("host")}/uploads/product-images/${file.filename}`,
    );
    const images = [...retainedImages, ...uploadedImageUrls];
    if (images.length === 0) {
      await removeUploadedFiles();
      return res.status(400).json({ message: "A product must have at least one image" });
    }
    if (images.length > 6) {
      await removeUploadedFiles();
      return res.status(400).json({ message: "A product can have up to 6 images" });
    }

    const editableFields = [
      "title",
      "category",
      "brand",
      "price",
      "originalPrice",
      "specialDiscountPercentage",
      "stock",
      "description",
    ];
    for (const field of editableFields) {
      if (body[field] !== undefined) product[field] = body[field];
    }
    if (body.sizes !== undefined) product.sizes = normalizeProductOptions(body.sizes);
    if (body.colors !== undefined) product.colors = normalizeProductOptions(body.colors);
    if (body.colorImageSelections !== undefined) {
      product.colorImages = normalizeColorImageSelections(
        body.colorImageSelections,
        images,
        body.colors !== undefined
          ? normalizeProductOptions(body.colors)
          : product.colors,
      );
    } else {
      product.colorImages = (product.colorImages || [])
        .map((group) => ({
          color: group.color,
          images: group.images.filter((image) => images.includes(image)),
        }))
        .filter((group) => group.images.length);
    }
    product.images = images;
    await product.save();

    const updatedProduct = await Product.findById(product._id).populate(
      "seller",
      "name email",
    );
    res.json(updatedProduct);
  } catch (error) {
    await removeUploadedFiles();
    next(error);
  }
};

export const deleteAdminProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted by admin" });
  } catch (error) {
    next(error);
  }
};

// --- ORDER MANAGEMENT ---
export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name email")
      .populate("items.product", "title price")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["Processing", "Shipped", "Delivered", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.orderStatus = status;
    await order.save();
    res.json({ message: "Order status updated", order });
  } catch (error) {
    next(error);
  }
};

// --- CATEGORY MODULE ---
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required" });
    const exists = await Category.findOne({
      name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (exists)
      return res.status(400).json({ message: "Category already exists" });

    const category = await Category.create({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
    });
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid category id" });
    }
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    const duplicate = await Category.findOne({
      _id: { $ne: category._id },
      name: {
        $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: "A category with this name already exists" });
    }

    const previousName = category.name;
    const previousSlug = category.slug;
    const newSlug = name.toLowerCase().replace(/\s+/g, "-");
    category.name = name;
    category.slug = newSlug;
    await category.save();
    try {
      await Product.updateMany(
        { category: previousName },
        { $set: { category: name } },
      );
    } catch (error) {
      category.name = previousName;
      category.slug = previousSlug;
      await category.save();
      throw error;
    }
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
};

// --- COUPON MODULE ---
const parseCouponDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return parsedDate.toISOString().slice(0, 10) === value ? parsedDate : null;
};

export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json(coupons);
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const { code, discountPercentage, minOrderAmount, startDate, expiryDate } = req.body;
    const normalizedCode = String(code || "").trim().toUpperCase();
    const parsedStartDate = parseCouponDate(startDate);
    const parsedExpiryDate = parseCouponDate(expiryDate);
    if (
      !normalizedCode ||
      !parsedStartDate ||
      !parsedExpiryDate
    ) {
      return res.status(400).json({ message: "Coupon code and valid start and end dates are required" });
    }
    if (parsedExpiryDate < parsedStartDate) {
      return res.status(400).json({ message: "Coupon end date must be on or after its start date" });
    }
    const exists = await Coupon.findOne({ code: normalizedCode });
    if (exists)
      return res.status(400).json({ message: "Coupon code already exists" });

    const coupon = await Coupon.create({
      code: normalizedCode,
      discountPercentage,
      minOrderAmount,
      startDate: parsedStartDate,
      expiryDate: parsedExpiryDate,
    });
    res.status(201).json(coupon);
  } catch (error) {
    next(error);
  }
};

export const toggleCouponStatus = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    coupon.isActive = !coupon.isActive;
    await coupon.save();
    res.json({
      message: `Coupon is now ${coupon.isActive ? "Active" : "Inactive"}`,
      coupon,
    });
  } catch (error) {
    next(error);
  }
};
