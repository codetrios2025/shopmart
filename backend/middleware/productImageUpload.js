import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const uploadDirectory = fileURLToPath(
  new URL("../uploads/product-images/", import.meta.url),
);
const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
      callback(error, uploadDirectory);
    });
  },
  filename(req, file, callback) {
    callback(
      null,
      `${crypto.randomUUID()}${extensionsByMimeType[file.mimetype] || ".img"}`,
    );
  },
});

const upload = multer({
  storage,
  limits: {
    files: 6,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (!extensionsByMimeType[file.mimetype]) {
      const error = new Error("Product images must be JPEG, PNG, WebP, or GIF files");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const uploadProductImages = (req, res, next) => {
  upload.array("images", 6)(req, res, (error) => {
    if (error) return next(error);
    req.body ||= {};
    next();
  });
};
export const productImageUploadDirectory = uploadDirectory;
