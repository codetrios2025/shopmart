import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";

const localUploadsDirectory = fileURLToPath(
  new URL("../uploads/", import.meta.url),
);

const uploadRoot = path.resolve(
  process.env.UPLOAD_DIR || localUploadsDirectory,
);
export const profileImageUploadDirectory = path.join(
  uploadRoot,
  "profile-images",
);

const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      fs.mkdir(profileImageUploadDirectory, { recursive: true }, (error) => {
        callback(error, profileImageUploadDirectory);
      });
    },
    filename(req, file, callback) {
      callback(
        null,
        `${crypto.randomUUID()}${extensionsByMimeType[file.mimetype]}`,
      );
    },
  }),
  limits: { files: 1, fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!extensionsByMimeType[file.mimetype]) {
      const error = new Error(
        "Profile images must be JPEG, PNG, WebP, or GIF files",
      );
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const uploadProfileImage = (req, res, next) => {
  upload.single("profileImage")(req, res, (error) => {
    if (error) return next(error);
    req.body ||= {};
    next();
  });
};
