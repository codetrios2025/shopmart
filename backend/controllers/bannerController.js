import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import Banner from "../models/Banner.js";
import { bannerImageUploadDirectory } from "../middleware/bannerImageUpload.js";

const bannerFields = [
  "eyebrow",
  "title",
  "description",
  "buttonLabel",
  "link",
  "imageUrl",
  "imageAlt",
  "placement",
  "theme",
  "sortOrder",
  "isActive",
];

const validateBanner = (body) => {
  const banner = {};
  for (const field of bannerFields) {
    if (field === "sortOrder") {
      banner.sortOrder = Number(body.sortOrder);
      if (
        !Number.isInteger(banner.sortOrder) ||
        banner.sortOrder < 0 ||
        banner.sortOrder > 100
      ) {
        return { error: "Sort order must be a whole number from 0 to 100" };
      }
      continue;
    }

    if (field === "isActive") {
      if (body.isActive === "true") {
        banner.isActive = true;
        continue;
      }
      if (body.isActive === "false") {
        banner.isActive = false;
        continue;
      }
      if (typeof body.isActive !== "boolean") {
        return { error: "Banner status must be active or inactive" };
      }
      banner.isActive = body.isActive;
      continue;
    }

    if (field === "description") {
      if (body.description !== undefined && typeof body.description !== "string") {
        return { error: "description must be text" };
      }
      banner.description = (body.description || "").trim();
      continue;
    }

    if (typeof body[field] !== "string") {
      return { error: `${field} is required` };
    }
    banner[field] = body[field].trim();
    if (!banner[field]) return { error: `${field} is required` };
  }

  const maximumLengths = {
    eyebrow: 32,
    title: 80,
    description: 180,
    buttonLabel: 24,
    link: 200,
    imageUrl: 2048,
    imageAlt: 120,
  };
  for (const [field, maximum] of Object.entries(maximumLengths)) {
    if (banner[field].length > maximum) {
      return { error: `${field} must be ${maximum} characters or fewer` };
    }
  }

  if (!["main", "side"].includes(banner.placement)) {
    return { error: "Placement must be main or side" };
  }
  if (!["indigo", "blue", "rose", "amber", "emerald"].includes(banner.theme)) {
    return { error: "Select a supported banner theme" };
  }
  if (
    !/^\/(?!\/)[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9._~%=&-]*)?$/.test(banner.link)
  ) {
    return { error: "Banner links must point to a valid internal page" };
  }

  if (/^\/uploads\/banner-images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(banner.imageUrl)) {
    return { banner };
  }

  try {
    const imageUrl = new URL(banner.imageUrl);
    if (
      imageUrl.protocol !== "https:" ||
      imageUrl.username ||
      imageUrl.password
    ) {
      return { error: "Banner images must use a secure HTTPS URL" };
    }
  } catch {
    return { error: "Enter a valid HTTPS image URL" };
  }

  return { banner };
};

const removeUploadedImage = async (file) => {
  if (!file) return;
  try {
    await fs.unlink(path.join(bannerImageUploadDirectory, file.filename));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const resolveBannerBody = (req) => ({
  ...req.body,
  ...(req.file && {
    imageUrl: `/uploads/banner-images/${req.file.filename}`,
  }),
});

const activeBannerLimitIsReached = async (banner, excludeId) => {
  if (!banner.isActive) return false;
  const query = { isActive: true };
  if (excludeId) query._id = { $ne: excludeId };
  const activeCount = await Banner.countDocuments(query);
  return activeCount >= 10;
};

export const getStoreBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .select(
        "eyebrow title description buttonLabel link imageUrl imageAlt placement theme sortOrder isActive",
      )
      .sort({ sortOrder: 1, _id: 1 })
      .limit(10)
      .lean();
    res.json(
      banners.flatMap((banner) => {
        const result = validateBanner(banner);
        return result.error
          ? []
          : [{ ...result.banner, _id: banner._id }];
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const getAdminBanners = async (req, res, next) => {
  try {
    const banners = await Banner.find()
      .sort({ placement: 1, sortOrder: 1, createdAt: -1 })
      .lean();
    res.json(banners);
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req, res, next) => {
  try {
    const result = validateBanner(resolveBannerBody(req));
    if (result.error) {
      await removeUploadedImage(req.file);
      return res.status(400).json({ message: result.error });
    }
    if (await activeBannerLimitIsReached(result.banner)) {
      await removeUploadedImage(req.file);
      return res.status(409).json({
        message: "A maximum of 10 banners can be active at once",
      });
    }
    const banner = await Banner.create(result.banner);
    res.status(201).json(banner);
  } catch (error) {
    await removeUploadedImage(req.file);
    next(error);
  }
};

export const updateBanner = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      await removeUploadedImage(req.file);
      return res.status(400).json({ message: "Invalid banner id" });
    }
    const result = validateBanner(resolveBannerBody(req));
    if (result.error) {
      await removeUploadedImage(req.file);
      return res.status(400).json({ message: result.error });
    }
    if (await activeBannerLimitIsReached(result.banner, req.params.id)) {
      await removeUploadedImage(req.file);
      return res.status(409).json({
        message: "A maximum of 10 banners can be active at once",
      });
    }
    const banner = await Banner.findByIdAndUpdate(req.params.id, result.banner, {
      new: true,
      runValidators: true,
    });
    if (!banner) {
      await removeUploadedImage(req.file);
      return res.status(404).json({ message: "Banner not found" });
    }
    res.json(banner);
  } catch (error) {
    await removeUploadedImage(req.file);
    next(error);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid banner id" });
    }
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });
    res.json({ message: "Banner deleted" });
  } catch (error) {
    next(error);
  }
};
