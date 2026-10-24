import mongoose from "mongoose";

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    isSubscribed: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model(
  "NewsletterSubscriber",
  newsletterSubscriberSchema,
);
