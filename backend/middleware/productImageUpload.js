import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";

const localUploadsDirectory = fileURLToPath(
  new URL("../uploads/", import.meta.url),
);

// Local development defaults to backend/uploads.
// On Hostinger, set UPLOAD_DIR to a writable directory outside hbuilds/current.
const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR || localUploadsDirectory,
);
export const productImageUploadDirectory = path.join(
  uploadRoot,
  "product-images",
);

const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    fs.mkdir(productImageUploadDirectory, { recursive: true }, (error) => {
      callback(error, productImageUploadDirectory);
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
      const error = new Error(
        "Product images must be JPEG, PNG, WebP, or GIF files",
      );
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
