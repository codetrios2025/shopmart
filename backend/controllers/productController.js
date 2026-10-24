import Product from "../models/Product.js";
import Category from "../models/Category.js";
import fs from "fs/promises";
import path from "path";
import { productImageUploadDirectory } from "../middleware/productImageUpload.js";
import { normalizeColorImageSelections } from "../utils/productImages.js";
import {
  applySpecialDealPricing,
  getLiveSpecialDeals,
} from "../utils/specialDeals.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeProductOptions = (value) => {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = value.split(",");
    }
  }
  if (value === undefined) return [];
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

export const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      page = 1,
      limit = 9,
    } = req.query;
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(48, Math.max(1, Number(limit) || 9));
    const query = {};

    if (category) query.category = new RegExp(escapeRegex(String(category)), "i");
    if (search) {
      const expression = new RegExp(escapeRegex(String(search)), "i");
      query.$or = [{ title: expression }, { brand: expression }];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice && Number.isFinite(Number(minPrice)))
        query.price.$gte = Number(minPrice);
      if (maxPrice && Number.isFinite(Number(maxPrice)))
        query.price.$lte = Number(maxPrice);
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);
    const activeDeals = await getLiveSpecialDeals(
      products.map((product) => product._id),
    );
    const dealsByProduct = new Map(
      activeDeals.map((deal) => [String(deal.product), deal]),
    );

    res.json({
      products: products.map((product) =>
        applySpecialDealPricing(
          product,
          dealsByProduct.get(String(product._id)),
        ),
      ),
      page: currentPage,
      totalPages: Math.ceil(count / pageSize),
      totalCount: count,
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "seller",
      "name email",
    );
    if (!product) return res.status(404).json({ message: "Product not found" });
    const [deal] = await getLiveSpecialDeals([product._id]);
    res.json(applySpecialDealPricing(product, deal));
  } catch (error) {
    next(error);
  }
};

export const getSellerProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ seller: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

export const getStoreCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("name slug")
      .sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  const uploadedFiles = req.files || [];
  try {
    const body = req.body || {};
    const images = uploadedFiles.length
      ? uploadedFiles.map(
          (file) =>
            `${req.protocol}://${req.get("host")}/uploads/product-images/${file.filename}`,
        )
      : body.images;
    if (!Array.isArray(images) || images.length === 0) {
      await Promise.all(
        uploadedFiles.map((file) =>
          fs.unlink(path.join(productImageUploadDirectory, file.filename)),
        ),
      );
      return res.status(400).json({ message: "At least one product image is required" });
    }
    const colors = normalizeProductOptions(body.colors);
    const product = new Product({
      ...body,
      images,
      sizes: normalizeProductOptions(body.sizes),
      colors,
      colorImages: normalizeColorImageSelections(
        body.colorImageSelections,
        images,
        colors,
      ),
      seller: req.user._id,
    });
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    await Promise.all(
      uploadedFiles.map((file) =>
        fs.unlink(path.join(productImageUploadDirectory, file.filename)).catch(
          (cleanupError) => {
            if (cleanupError.code !== "ENOENT") throw cleanupError;
          },
        ),
      ),
    );
    next(error);
  }
};
