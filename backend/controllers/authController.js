import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";
import PasswordResetToken from "../models/PasswordResetToken.js";
import { profileImageUploadDirectory } from "../middleware/profileImageUpload.js";
import {
  getEmailConfigurationStatus,
  isEmailConfigured,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../utils/email.js";

const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const googleOAuthClient = new OAuth2Client();

export const googleLogin = async (req, res, next) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const credential = req.body?.credential;
    if (!clientId) {
      return res.status(503).json({
        message: "Google sign-in is not configured on this server",
      });
    }
    if (typeof credential !== "string" || credential.length > 8192) {
      return res.status(400).json({ message: "A valid Google credential is required" });
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload?.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)
    ) {
      return res.status(401).json({
        message: "Google account email could not be verified",
      });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ googleId: payload.sub }).select("+googleId");
    if (!user) {
      user = await User.findOne({ email }).select("+googleId");
      if (user?.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({
          message: "This email is linked to a different Google account",
        });
      }
      if (!user) {
        user = await User.create({
          name: String(payload.name || email.split("@")[0]).slice(0, 80),
          email,
          googleId: payload.sub,
          password: crypto.randomBytes(48).toString("hex"),
          role: "customer",
        });
      } else {
        user.googleId = payload.sub;
        await user.save();
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "This account is inactive. Contact the store administrator.",
      });
    }
    if (user.role === "seller" && !user.sellerApproved) {
      return res.status(403).json({
        message: "Your seller account is awaiting admin approval.",
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || "",
      ...(user.role === "seller" && { sellerCode: user.sellerCode }),
      token: generateToken(user._id, user.tokenVersion),
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    const { phone } = body;
    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role === "seller" ? "seller" : "customer";
    if (
      !name ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Name, a valid email, and a password of at least 8 characters are required",
      });
    }
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      ...(role === "seller" && { sellerApproved: false }),
    });
    let welcomeEmailSent = false;
    const emailConfiguration = getEmailConfigurationStatus();
    if (role === "customer" && emailConfiguration.configured) {
      try {
        await sendWelcomeEmail({ name: user.name, email: user.email });
        welcomeEmailSent = true;
      } catch (error) {
        console.error(
          "SHOPMART welcome email delivery failed.",
          JSON.stringify({
            code: error.code || "unknown",
            responseCode: error.responseCode || null,
            command: error.command || null,
          }),
        );
      }
    } else if (role === "customer") {
      console.warn(
        `SHOPMART welcome email was not sent; SMTP configuration is missing or contains placeholders: ${[
          ...emailConfiguration.missingVariables,
          ...emailConfiguration.placeholderVariables,
        ].join(", ") || "check SMTP values"}.`,
      );
    }
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || "",
      ...(role === "customer" && {
        token: generateToken(user._id, user.tokenVersion),
      }),
      ...(role === "seller" && { sellerCode: user.sellerCode }),
      welcomeEmailSent,
      ...(role === "seller" && {
        message:
          "Seller registration submitted. Sign-in will be available after admin approval.",
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password =
      typeof body.password === "string" ? body.password : "";
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      if (!user.isActive) {
        return res.status(403).json({
          message: "This account is inactive. Contact the store administrator.",
        });
      }
      if (user.role === "seller" && !user.sellerApproved) {
        return res.status(403).json({
          message: "Your seller account is awaiting admin approval.",
        });
      }
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || "",
        ...(user.role === "seller" && { sellerCode: user.sellerCode }),
        token: generateToken(user._id, user.tokenVersion),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const body = req.body || {};
    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long",
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from your current password",
      });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    user.password = newPassword;
    user.tokenVersion += 1;
    await user.save();
    await PasswordResetToken.deleteOne({ user: user._id });
    res.json({
      message: "Password updated successfully",
      token: generateToken(user._id, user.tokenVersion),
    });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  const genericResponse = {
    message:
      "If an account exists for that email, password reset instructions will be sent.",
  };
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isEmailConfigured()) {
      return res.status(503).json({
        message:
          "Password reset email is currently unavailable. Please contact the store administrator.",
      });
    }
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.json(genericResponse);
    }
    const user = await User.findOne({ email });
    if (!user) return res.json(genericResponse);
    const recentRequest = await PasswordResetToken.findOne({ user: user._id });
    if (
      recentRequest &&
      recentRequest.createdAt.getTime() > Date.now() - 60 * 1000
    ) {
      return res.json(genericResponse);
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await PasswordResetToken.findOneAndDelete({ user: user._id });
    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");
    try {
      await sendPasswordResetEmail({
        name: user.name,
        email: user.email,
        resetUrl: `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`,
      });
    } catch {
      await PasswordResetToken.deleteOne({ user: user._id, tokenHash });
      console.error("SHOPMART password reset email delivery failed.");
    }
    return res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const body = req.body || {};
    const token = String(body.token || "");
    const password =
      typeof body.password === "string" ? body.password : "";
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        message: "This password reset link is invalid or expired",
      });
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetRecord = await PasswordResetToken.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });
    if (!resetRecord) {
      return res.status(400).json({
        message: "This password reset link is invalid or expired",
      });
    }
    const user = await User.findById(resetRecord.user);
    if (!user) {
      await resetRecord.deleteOne();
      return res.status(400).json({
        message: "This password reset link is invalid or expired",
      });
    }
    user.password = password;
    user.tokenVersion += 1;
    await user.save();
    await PasswordResetToken.deleteMany({ user: user._id });
    res.json({
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      "-password -tokenVersion",
    );
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim();
    if (!name || name.length > 80) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(400).json({
        message: "Name is required and must be 80 characters or fewer",
      });
    }
    if (phone.length > 24 || (phone && !/^[+\d\s().-]{7,24}$/.test(phone))) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(400).json({ message: "Enter a valid mobile number" });
    }

    const addressFields = ["street", "city", "state", "pincode"];
    const address = Object.fromEntries(
      addressFields.map((field) => [
        field,
        String(req.body?.[field] || "").trim(),
      ]),
    );
    const hasAddress = Object.values(address).some(Boolean);
    if (
      hasAddress &&
      (addressFields.some((field) => !address[field]) ||
        address.street.length > 200 ||
        address.city.length > 80 ||
        address.state.length > 80 ||
        address.pincode.length > 12 ||
        !/^[A-Za-z0-9 -]{4,12}$/.test(address.pincode))
    ) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(400).json({
        message:
          "Enter a complete address with a valid postal or PIN code, or leave all address fields blank",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      if (req.file) await fs.unlink(req.file.path);
      return res.status(404).json({ message: "Account not found" });
    }
    const previousProfileImage = user.profileImage;
    user.name = name;
    user.phone = phone;
    if (hasAddress) {
      const primaryAddress =
        user.addresses.find((item) => item.isDefault) || user.addresses[0];
      if (primaryAddress) {
        Object.assign(primaryAddress, address);
        primaryAddress.isDefault = true;
        user.addresses.forEach((item) => {
          if (String(item._id) !== String(primaryAddress._id)) {
            item.isDefault = false;
          }
        });
      } else {
        user.addresses.push({ ...address, type: "Home", isDefault: true });
      }
    }
    if (req.file) {
      user.profileImage = `/uploads/profile-images/${req.file.filename}`;
    }
    await user.save();

    if (
      req.file &&
      previousProfileImage &&
      /^\/uploads\/profile-images\/[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(
        previousProfileImage,
      )
    ) {
      try {
        await fs.unlink(
          path.join(
            profileImageUploadDirectory,
            path.basename(previousProfileImage),
          ),
        );
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.warn("SHOPMART could not remove a replaced profile image.", {
            code: error.code || "unknown",
          });
        }
      }
    }

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.tokenVersion;
    res.json({ message: "Profile updated successfully", user: safeUser });
  } catch (error) {
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== "ENOENT") {
          console.warn("SHOPMART could not clean up an uploaded profile image.", {
            code: cleanupError.code || "unknown",
          });
        }
      }
    }
    next(error);
  }
};
