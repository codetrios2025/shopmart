import path from "node:path";
import nodemailer from "nodemailer";
import { bannerImageUploadDirectory } from "../middleware/bannerImageUpload.js";

let transporter;
let transporterSignature;

export const getEmailConfigurationStatus = () => {
  const requiredVariables = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"];
  const missingVariables = requiredVariables.filter(
    (name) => !process.env[name]?.trim(),
  );
  const placeholderVariables = requiredVariables.filter((name) =>
    /replace|your_|example\.com|<.*>/i.test(process.env[name] || ""),
  );
  return {
    configured:
      missingVariables.length === 0 && placeholderVariables.length === 0,
    missingVariables,
    placeholderVariables,
  };
};

export const isEmailConfigured = () =>
  getEmailConfigurationStatus().configured;

const getTransporter = () => {
  if (!isEmailConfigured()) {
    throw new Error("SMTP email delivery is not configured");
  }
  const signature = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_SECURE,
    process.env.SMTP_USER,
  ].join("|");
  if (!transporter || signature !== transporterSignature) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure:
        process.env.SMTP_SECURE === "true" ||
        Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    transporterSignature = signature;
  }
  return transporter;
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const emailLayout = (title, content) => `
  <div style="margin:0;background:#f3f6fb;padding:32px 12px;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5eaf2;border-radius:16px;overflow:hidden">
      <div style="background:#0b1528;padding:24px 32px;color:#ffffff">
        <div style="font-size:24px;font-weight:800;letter-spacing:-.5px">SHOPMART</div>
        <div style="margin-top:6px;color:#bdc9dc;font-size:13px">${escapeHtml(title)}</div>
      </div>
      <div style="padding:30px 32px;line-height:1.65">${content}</div>
      <div style="border-top:1px solid #e8edf4;padding:18px 32px;color:#68758a;font-size:12px">
        This is an automated message from SHOPMART. Please do not reply with payment or password information.
      </div>
    </div>
  </div>`;

export const sendWelcomeEmail = async ({ name, email }) => {
  const greeting = escapeHtml(name);
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Welcome to SHOPMART",
    text: `Welcome to SHOPMART, ${name}! Your account is ready. Sign in to discover products and manage your orders.`,
    html: emailLayout(
      "Welcome to the community",
      `<h1 style="margin:0 0 12px;font-size:24px">Welcome, ${greeting}!</h1>
       <p>Your SHOPMART account is ready. Explore the store, save products to your cart, and keep track of your orders from your account.</p>
       <a href="${escapeHtml(process.env.FRONTEND_URL || "http://localhost:5173")}" style="display:inline-block;margin-top:12px;padding:12px 20px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Start shopping</a>`,
    ),
  });
};

export const sendPasswordResetEmail = async ({ name, email, resetUrl }) => {
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Reset your SHOPMART password",
    text: `Hello ${name}, use this one-time link to reset your password. It expires in 1 hour: ${resetUrl}. If you did not request this, ignore this email.`,
    html: emailLayout(
      "Password reset",
      `<h1 style="margin:0 0 12px;font-size:24px">Reset your password</h1>
       <p>Hello ${escapeHtml(name)}, we received a request to reset your SHOPMART password.</p>
       <a href="${escapeHtml(resetUrl)}" style="display:inline-block;margin:16px 0;padding:12px 20px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Choose a new password</a>
       <p>This one-time link expires in 1 hour. If you did not request a reset, you can ignore this message.</p>`,
    ),
  });
};

export const sendOrderConfirmationEmail = async ({ name, email, order }) => {
  const itemsText = order.items
    .map((item) => `${item.quantity} x ${item.title} — ₹${item.price}`)
    .join("\n");
  const itemRows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #edf0f5">${escapeHtml(item.title)} × ${item.quantity}</td><td style="padding:10px 0;border-bottom:1px solid #edf0f5;text-align:right">₹${Number(item.price).toLocaleString("en-IN")}</td></tr>`,
    )
    .join("");
  const orderUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/track-order`;
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: `SHOPMART order confirmed — #${String(order._id).slice(-8)}`,
    text: `Hello ${name}, your order #${String(order._id).slice(-8)} is confirmed.\n\n${itemsText}\n\nTotal: ₹${Number(order.totalAmount).toLocaleString("en-IN")}\nPayment: ${order.paymentInfo?.status || "Pending"}\nTrack your order: ${orderUrl}`,
    html: emailLayout(
      "Your order is confirmed",
      `<h1 style="margin:0 0 8px;font-size:24px">Thank you, ${escapeHtml(name)}!</h1>
       <p>Your order <strong>#${escapeHtml(String(order._id).slice(-8))}</strong> has been confirmed.</p>
       <table style="width:100%;margin:20px 0;border-collapse:collapse;font-size:14px">${itemRows}</table>
       <div style="border-top:1px solid #dfe5ee;padding-top:14px">
         <p style="margin:5px 0">Subtotal <span style="float:right">₹${Number(order.subtotal).toLocaleString("en-IN")}</span></p>
         <p style="margin:5px 0">Delivery <span style="float:right">₹${Number(order.deliveryFee).toLocaleString("en-IN")}</span></p>
         <p style="margin:5px 0">Discount <span style="float:right">−₹${Number(order.discountAmount).toLocaleString("en-IN")}</span></p>
         <p style="margin:12px 0 0;font-size:18px;font-weight:700">Total <span style="float:right">₹${Number(order.totalAmount).toLocaleString("en-IN")}</span></p>
       </div>
       <p style="margin-top:22px">Payment status: <strong>${escapeHtml(order.paymentInfo?.status || "Pending")}</strong></p>
       <a href="${escapeHtml(orderUrl)}" style="display:inline-block;margin-top:10px;padding:12px 20px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Track your order</a>`,
    ),
  });
};

export const sendNewsletterEmail = async ({
  email,
  subject,
  message,
  banner,
  unsubscribeUrl,
}) => {
  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
  const uploadedBanner = banner?.imageUrl?.match(
    /^\/uploads\/banner-images\/([a-f0-9-]+\.(?:jpg|png|webp|gif))$/i,
  );
  const bannerImageCid = uploadedBanner ? "shopmart-banner-image" : null;
  const bannerImageUrl = bannerImageCid
    ? `cid:${bannerImageCid}`
    : banner?.imageUrl;
  const bannerHtml = banner
    ? `<div style="margin:24px 0;border:1px solid #e5eaf2;border-radius:14px;overflow:hidden">
        ${
          bannerImageUrl
            ? `<img src="${escapeHtml(bannerImageUrl)}" alt="${escapeHtml(banner.imageAlt || banner.title)}" style="display:block;width:100%;max-height:300px;object-fit:cover">`
            : ""
        }
        <div style="padding:22px">
          <h2 style="margin:0 0 8px;font-size:22px">${escapeHtml(banner.title)}</h2>
          ${
            banner.description
              ? `<p style="margin:0;color:#526078">${escapeHtml(banner.description)}</p>`
              : ""
          }
          <a href="${escapeHtml(`${frontendUrl}${banner.link}`)}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:9px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(banner.buttonLabel)}</a>
        </div>
      </div>`
    : "";
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");
  const info = await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text: [
      message,
      banner
        ? `${banner.title}\n${banner.description || ""}\n${frontendUrl}${banner.link}`
        : "",
      `Unsubscribe: ${unsubscribeUrl}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: emailLayout(
      "SHOPMART news and promotions",
      `${safeMessage ? `<p style="white-space:normal">${safeMessage}</p>` : ""}${bannerHtml}
       <p style="margin-top:28px;color:#68758a;font-size:12px">You are receiving this email because you subscribed to SHOPMART updates.</p>
       <p style="margin-top:8px;font-size:12px"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#526078">Unsubscribe from promotional emails</a></p>`,
    ),
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    ...(uploadedBanner && {
      attachments: [
        {
          filename: uploadedBanner[1],
          path: path.join(bannerImageUploadDirectory, uploadedBanner[1]),
          cid: bannerImageCid,
        },
      ],
    }),
  });
  return {
    accepted: info.accepted.some(
      (recipient) => recipient.toLowerCase() === email.toLowerCase(),
    ),
    responseCode: info.responseCode || null,
  };
};
