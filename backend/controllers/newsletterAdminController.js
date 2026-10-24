import crypto from "crypto";
import mongoose from "mongoose";
import Banner from "../models/Banner.js";
import NewsletterCampaign from "../models/NewsletterCampaign.js";
import NewsletterSubscriber from "../models/NewsletterSubscriber.js";
import {
  getEmailConfigurationStatus,
  isEmailConfigured,
} from "../utils/email.js";
import { startNewsletterCampaignProcessor } from "../utils/newsletterCampaign.js";

const pageSizeLimit = 50;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const isPublicApiUrlValid = () => {
  if (!process.env.PUBLIC_API_URL) {
    return process.env.NODE_ENV !== "production";
  }
  try {
    const publicApiUrl = new URL(process.env.PUBLIC_API_URL);
    const usesSecureProtocol = publicApiUrl.protocol === "https:";
    const localHttpAllowed =
      process.env.NODE_ENV !== "production" &&
      publicApiUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(publicApiUrl.hostname);
    const hasApiPath = publicApiUrl.pathname.replace(/\/+$/, "").endsWith("/api");
    return (usesSecureProtocol || localHttpAllowed) && hasApiPath;
  } catch {
    return false;
  }
};

export const getNewsletterStatus = (req, res) => {
  res.json({
    emailConfigured: isEmailConfigured(),
    emailConfiguration: getEmailConfigurationStatus(),
    publicApiUrlValid: isPublicApiUrlValid(),
  });
};

export const getNewsletterSubscribers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      pageSizeLimit,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
    );
    const search = String(req.query.search || "").trim().slice(0, 100);
    const query = { isSubscribed: true };
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.email = new RegExp(escapedSearch, "i");
    }

    const [subscribers, total, subscribedTotal] = await Promise.all([
      NewsletterSubscriber.find(query)
        .select("email createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NewsletterSubscriber.countDocuments(query),
      NewsletterSubscriber.countDocuments({ isSubscribed: true }),
    ]);
    res.json({
      subscribers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      subscribedTotal,
    });
  } catch (error) {
    next(error);
  }
};

export const getNewsletterCampaigns = async (req, res, next) => {
  try {
    const campaigns = await NewsletterCampaign.find()
      .select(
        "subject banner.title status audienceCount processedCount sentCount failedCount skippedCount lastError createdAt startedAt completedAt",
      )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const createNewsletterCampaign = async (req, res, next) => {
  try {
    if (!isEmailConfigured()) {
      const error = new Error(
        "Email delivery is not configured. Ask the administrator to set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.",
      );
      error.statusCode = 503;
      throw error;
    }
    if (!isPublicApiUrlValid()) {
      const error = new Error(
        "Set PUBLIC_API_URL to the public HTTPS API URL ending in /api before sending campaigns.",
      );
      error.statusCode = 503;
      throw error;
    }

    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const bannerId = String(req.body?.bannerId || "").trim();
    if (!subject || subject.length > 160 || /[\r\n]/.test(subject)) {
      return res.status(400).json({
        message:
          "Campaign subject is required, must be 160 characters or fewer, and cannot contain line breaks",
      });
    }
    if (message.length > 5000) {
      return res.status(400).json({
        message: "Campaign message must be 5000 characters or fewer",
      });
    }
    if (!message && !bannerId) {
      return res.status(400).json({
        message: "Add a newsletter message or select a promotion banner",
      });
    }
    if (bannerId && !mongoose.isValidObjectId(bannerId)) {
      return res.status(400).json({ message: "Select a valid promotion banner" });
    }

    const [audienceCount, banner] = await Promise.all([
      NewsletterSubscriber.countDocuments({ isSubscribed: true }),
      bannerId
        ? Banner.findOne({ _id: bannerId, isActive: true })
            .select(
              "title description buttonLabel link imageUrl imageAlt isActive",
            )
            .lean()
        : Promise.resolve(null),
    ]);
    if (bannerId && !banner) {
      return res.status(400).json({
        message: "The selected promotion banner is no longer active",
      });
    }
    if (!audienceCount) {
      return res.status(400).json({
        message: "There are no active newsletter subscribers to receive this campaign",
      });
    }

    const campaign = await NewsletterCampaign.create({
      subject,
      message,
      banner: banner
        ? {
            title: banner.title,
            description: banner.description,
            buttonLabel: banner.buttonLabel,
            link: banner.link,
            imageUrl: banner.imageUrl,
            imageAlt: banner.imageAlt,
          }
        : undefined,
      audienceCount,
      createdBy: req.user._id,
    });

    startNewsletterCampaignProcessor();
    res.status(202).json({
      message: "Newsletter campaign queued for delivery",
      campaign,
    });
  } catch (error) {
    next(error);
  }
};

const safeCompareSignature = (email, signature) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(email)
    .digest();
  const provided = Buffer.from(signature, "hex");
  return (
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
};

const unsubscribePage = (message, success) => {
  const color = success ? "#047857" : "#b91c1c";
  return `<!doctype html>
    <html lang="en">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SHOPMART newsletter preferences</title>
      <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
        <main style="max-width:520px;margin:10vh auto;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:18px">
          <strong style="font-size:22px">SHOPMART</strong>
          <h1 style="font-size:22px">Newsletter preferences</h1>
          <p style="color:${color};line-height:1.6">${message}</p>
          ${
            success
              ? '<a href="/" style="display:inline-block;margin-top:12px;color:#2563eb">Return to SHOPMART</a>'
              : ""
          }
        </main>
      </body>
    </html>`;
};

const setUnsubscribeResponseHeaders = (res) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
  res.setHeader("Cache-Control", "no-store");
};

export const confirmNewsletterUnsubscribe = (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !safeCompareSignature(email, String(req.query.signature || ""))
  ) {
    setUnsubscribeResponseHeaders(res);
    return res
      .status(400)
      .type("html")
      .send(unsubscribePage("This unsubscribe link is invalid or expired.", false));
  }

  setUnsubscribeResponseHeaders(res);
  res
    .type("html")
    .send(`<!doctype html>
      <html lang="en">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Unsubscribe from SHOPMART emails</title>
        <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
          <main style="max-width:520px;margin:10vh auto;padding:32px;background:white;border:1px solid #e2e8f0;border-radius:18px">
            <strong style="font-size:22px">SHOPMART</strong>
            <h1 style="font-size:22px">Unsubscribe from promotional email</h1>
            <p style="color:#475569;line-height:1.6">Confirm below to stop receiving SHOPMART newsletter and promotional emails.</p>
            <form method="post" action="/api/newsletter/unsubscribe">
              <input type="hidden" name="email" value="${escapeHtml(email)}">
              <input type="hidden" name="signature" value="${String(req.query.signature)}">
              <button style="border:0;border-radius:10px;background:#dc2626;padding:12px 18px;color:white;font-weight:bold;cursor:pointer">Unsubscribe</button>
            </form>
          </main>
        </body>
      </html>`);
};

export const unsubscribeFromNewsletter = async (req, res, next) => {
  try {
    const email = String(req.body?.email || req.query.email || "")
      .trim()
      .toLowerCase();
    const signature = String(req.body?.signature || req.query.signature || "");
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !safeCompareSignature(email, signature)
    ) {
      setUnsubscribeResponseHeaders(res);
      return res
        .status(400)
        .type("html")
        .send(unsubscribePage("This unsubscribe link is invalid or expired.", false));
    }

    await NewsletterSubscriber.updateOne(
      { email },
      { $set: { isSubscribed: false } },
    );
    setUnsubscribeResponseHeaders(res);
    res
      .type("html")
      .send(unsubscribePage("You have been unsubscribed from SHOPMART promotional emails.", true));
  } catch (error) {
    next(error);
  }
};
