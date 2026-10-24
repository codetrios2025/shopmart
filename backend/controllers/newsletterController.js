import NewsletterSubscriber from "../models/NewsletterSubscriber.js";

export const subscribeToNewsletter = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const existingSubscriber = await NewsletterSubscriber.findOne({ email });
    if (existingSubscriber?.isSubscribed) {
      return res
        .status(200)
        .json({ message: "This email is already subscribed to the newsletter" });
    }

    if (existingSubscriber) {
      existingSubscriber.isSubscribed = true;
      await existingSubscriber.save();
    } else {
      await NewsletterSubscriber.create({ email });
    }
    return res
      .status(201)
      .json({ message: "Thanks for subscribing to the SHOPMART newsletter" });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json({ message: "This email is already subscribed to the newsletter" });
    }
    return next(error);
  }
};
