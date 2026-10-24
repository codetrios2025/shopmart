import crypto from "crypto";
import NewsletterCampaign from "../models/NewsletterCampaign.js";
import NewsletterSubscriber from "../models/NewsletterSubscriber.js";
import { sendNewsletterEmail } from "./email.js";

const batchSize = 5;
let processorRunning = false;

const createUnsubscribeUrl = (email) => {
  const signature = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(email)
    .digest("hex");
  const apiUrl = (
    process.env.PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 5000}/api`
  ).replace(/\/+$/, "");
  const url = new URL(`${apiUrl}/newsletter/unsubscribe`);
  url.searchParams.set("email", email);
  url.searchParams.set("signature", signature);
  return url.toString();
};

const sendBatch = async (campaign, subscribers) => {
  const stillSubscribed = await NewsletterSubscriber.find({
    _id: { $in: subscribers.map((subscriber) => subscriber._id) },
    isSubscribed: true,
  })
    .select("email")
    .lean();
  const results = await Promise.allSettled(
    stillSubscribed.map((subscriber) =>
      sendNewsletterEmail({
        email: subscriber.email,
        subject: campaign.subject,
        message: campaign.message,
        banner: campaign.banner,
        unsubscribeUrl: createUnsubscribeUrl(subscriber.email),
      }),
    ),
  );
  const failedResults = results.filter(
    (result) =>
      result.status === "rejected" || !result.value.accepted,
  );
  const sentCount = results.length - failedResults.length;
  const failedCount = failedResults.length;
  const processedCount = results.length;
  const skippedCount = subscribers.length - stillSubscribed.length;
  await NewsletterCampaign.updateOne(
    { _id: campaign._id, status: "sending" },
    {
      $inc: { sentCount, failedCount, processedCount, skippedCount },
    },
  );
  const failure = failedResults[0];
  if (failure) {
    const rejection =
      failure.status === "rejected" ? failure.reason : null;
    console.error(
      "SHOPMART newsletter recipient delivery failed.",
      JSON.stringify({
        campaignId: String(campaign._id),
        code: rejection?.code || "recipient_not_accepted",
        responseCode:
          rejection?.responseCode ||
          (failure.status === "fulfilled" ? failure.value.responseCode : null),
      }),
    );
  }
};

const processCampaign = async (queuedCampaign) => {
  const campaign = await NewsletterCampaign.findOneAndUpdate(
    { _id: queuedCampaign._id, status: "queued" },
    { $set: { status: "sending", startedAt: new Date(), lastError: "" } },
    { new: true },
  ).lean();
  if (!campaign) return;

  try {
    let batch = [];
    const subscribers = NewsletterSubscriber.find({ isSubscribed: true })
      .select("_id email")
      .lean()
      .cursor();
    for await (const subscriber of subscribers) {
      batch.push(subscriber);
      if (batch.length === batchSize) {
        await sendBatch(campaign, batch);
        batch = [];
      }
    }
    if (batch.length) await sendBatch(campaign, batch);

    const completed = await NewsletterCampaign.findById(campaign._id).lean();
    const status =
      completed.failedCount === 0
        ? "sent"
        : completed.sentCount > 0
          ? "partial"
          : "failed";
    await NewsletterCampaign.updateOne(
      { _id: campaign._id, status: "sending" },
      {
        $set: {
          status,
          completedAt: new Date(),
          ...(status === "failed" && {
            lastError: "No emails could be delivered. Check the SMTP server logs.",
          }),
        },
      },
    );
  } catch (error) {
    console.error(
      "SHOPMART newsletter campaign processing failed.",
      JSON.stringify({
        campaignId: String(campaign._id),
        code: error.code || "unknown",
        responseCode: error.responseCode || null,
      }),
    );
    await NewsletterCampaign.updateOne(
      { _id: campaign._id, status: "sending" },
      {
        $set: {
          status: "failed",
          completedAt: new Date(),
          lastError: "Campaign processing stopped. Check the SMTP server logs.",
        },
      },
    );
  }
};

const processQueuedCampaigns = async () => {
  if (processorRunning) return;
  processorRunning = true;
  try {
    while (true) {
      const queuedCampaign = await NewsletterCampaign.findOne({
        status: "queued",
      })
        .sort({ createdAt: 1 })
        .select("_id")
        .lean();
      if (!queuedCampaign) break;
      await processCampaign(queuedCampaign);
    }
  } catch (error) {
    console.error(
      "SHOPMART newsletter queue failed.",
      JSON.stringify({ code: error.code || "unknown" }),
    );
  } finally {
    processorRunning = false;
  }
};

export const startNewsletterCampaignProcessor = () => {
  void processQueuedCampaigns();
};
