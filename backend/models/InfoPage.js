import mongoose from "mongoose";

const infoPageSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    linkLabel: { type: String, trim: true, maxlength: 80, default: "" },
    linkTo: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false },
);

const infoPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "contact",
        "track-order",
        "returns-refunds",
        "shipping-policy",
        "faq",
        "about",
        "careers",
        "terms-conditions",
        "privacy-policy",
      ],
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    intro: { type: String, required: true, trim: true, maxlength: 1000 },
    sections: {
      type: [infoPageSectionSchema],
      validate: {
        validator(sections) {
          return sections.length <= 30;
        },
        message: "A page can have up to 30 content sections.",
      },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export default mongoose.model("InfoPage", infoPageSchema);
