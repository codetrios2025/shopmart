import InfoPage from "../models/InfoPage.js";

export const infoPageSlugs = [
  "contact",
  "track-order",
  "returns-refunds",
  "shipping-policy",
  "faq",
  "about",
  "careers",
  "terms-conditions",
  "privacy-policy",
];

export const defaultInfoPages = {
  contact: {
    slug: "contact",
    title: "Contact Us",
    intro: "We’re here to help you with your SHOPMART experience.",
    sections: [
      {
        title: "Order support",
        body: "For delivery and order-status updates, visit Track Order while signed in to the customer account used at checkout.",
        linkLabel: "Track an order",
        linkTo: "/track-order",
      },
      {
        title: "Product and shopping help",
        body: "Browse the FAQ for help with accounts, shopping, payments, and orders. Product availability and details are shown on each product page.",
        linkLabel: "Read the FAQ",
        linkTo: "/info/faq",
      },
    ],
  },
  "track-order": {
    slug: "track-order",
    title: "Track your order",
    intro: "Sign in with the customer account used at checkout to see your order and payment status.",
    sections: [],
  },
  "returns-refunds": {
    slug: "returns-refunds",
    title: "Returns & Refunds",
    intro: "Review your order details and product listing if you need help with an item.",
    sections: [
      {
        title: "Requesting assistance",
        body: "Keep your order details available and contact the store administrator with the order ID and a description of the issue. Return eligibility and any applicable terms should be confirmed for the specific product and seller.",
      },
      {
        title: "Refund status",
        body: "Payment and order statuses are available from your customer account. A payment marked pending has not been recorded as completed by SHOPMART.",
        linkLabel: "View order status",
        linkTo: "/track-order",
      },
    ],
  },
  "shipping-policy": {
    slug: "shipping-policy",
    title: "Shipping Policy",
    intro: "Delivery details are confirmed during checkout and in your order information.",
    sections: [
      {
        title: "Delivery charges",
        body: "The cart shows an estimated delivery charge. The server confirms the final amount when the order is created.",
      },
      {
        title: "Track your order",
        body: "Sign in to see current order and delivery status. Delivery timing can depend on the seller and destination.",
        linkLabel: "Track an order",
        linkTo: "/track-order",
      },
    ],
  },
  faq: {
    slug: "faq",
    title: "Frequently Asked Questions",
    intro: "Quick answers to common SHOPMART questions.",
    sections: [
      {
        title: "How do I place an order?",
        body: "Add products to your cart, enter a complete delivery address, and continue to payment. The server confirms the final product prices and delivery charges.",
      },
      {
        title: "Where can I see my order status?",
        body: "Sign in with the customer account used to place the order and open Track Order.",
        linkLabel: "Track an order",
        linkTo: "/track-order",
      },
      {
        title: "Why did payment not start?",
        body: "Online payments require the store administrator to configure valid Razorpay credentials. If the problem continues, contact the store administrator.",
      },
      {
        title: "How do I find a product?",
        body: "Use the search field or browse all products and filter by category.",
        linkLabel: "Browse products",
        linkTo: "/category",
      },
    ],
  },
  about: {
    slug: "about",
    title: "About SHOPMART",
    intro: "SHOPMART brings products from fashion, electronics, home, beauty, and more together in one place.",
    sections: [
      {
        title: "A simpler way to shop",
        body: "Discover products, compare details, manage your cart, and review your orders from your account.",
      },
      {
        title: "Our marketplace",
        body: "Products may be offered by different sellers. Product listings show the available description, pricing, and stock information.",
      },
    ],
  },
  careers: {
    slug: "careers",
    title: "Careers",
    intro: "Interested in building a better online shopping experience?",
    sections: [
      {
        title: "Opportunities",
        body: "There are no open positions listed at this time. Please check back for future updates.",
      },
    ],
  },
  "terms-conditions": {
    slug: "terms-conditions",
    title: "Terms & Conditions",
    intro: "These terms explain the basic rules for using the SHOPMART website.",
    sections: [
      {
        title: "Using the store",
        body: "Keep account details accurate and secure. You are responsible for activity carried out using your account.",
      },
      {
        title: "Orders and product information",
        body: "Product availability, descriptions, and prices are shown in the store and confirmed by the server at checkout. An order is subject to successful payment processing where payment is required.",
      },
      {
        title: "Marketplace listings",
        body: "Products may be listed by independent sellers. Listing details are provided to help you make an informed purchase.",
      },
    ],
  },
  "privacy-policy": {
    slug: "privacy-policy",
    title: "Privacy Policy",
    intro: "This page summarizes how information is used while you use SHOPMART.",
    sections: [
      {
        title: "Information you provide",
        body: "Account, delivery, and order information is used to provide store features such as sign-in, checkout, and order history.",
      },
      {
        title: "Newsletter",
        body: "If you subscribe, your email address is stored so the store can manage newsletter subscriptions. You can contact the store administrator to request removal.",
      },
      {
        title: "Payments",
        body: "Payment processing is handled through the configured payment provider. SHOPMART does not ask you to enter payment credentials into newsletter or contact forms.",
      },
    ],
  },
};

export const getPublicInfoPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!infoPageSlugs.includes(slug)) {
      return res.status(404).json({ message: "Information page not found." });
    }
    const page = await InfoPage.findOne({ slug }).lean();
    res.json(page || defaultInfoPages[slug]);
  } catch (error) {
    next(error);
  }
};

export const getAdminInfoPages = async (req, res, next) => {
  try {
    const savedPages = await InfoPage.find().lean();
    const savedBySlug = new Map(savedPages.map((page) => [page.slug, page]));
    res.json(infoPageSlugs.map((slug) => savedBySlug.get(slug) || defaultInfoPages[slug]));
  } catch (error) {
    next(error);
  }
};

export const updateAdminInfoPage = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!infoPageSlugs.includes(slug)) {
      return res.status(404).json({ message: "Information page not found." });
    }
    const { title, intro, sections } = req.body || {};
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 120 ||
      typeof intro !== "string" ||
      !intro.trim() ||
      intro.trim().length > 1000 ||
      !Array.isArray(sections) ||
      sections.length > 30
    ) {
      return res.status(400).json({ message: "Enter a page title, introduction, and up to 30 content sections." });
    }

    const normalizedSections = [];
    for (const section of sections) {
      const sectionTitle =
        typeof section?.title === "string" ? section.title.trim() : "";
      const body = typeof section?.body === "string" ? section.body.trim() : "";
      const linkLabel =
        typeof section?.linkLabel === "string" ? section.linkLabel.trim() : "";
      const linkTo =
        typeof section?.linkTo === "string" ? section.linkTo.trim() : "";
      if (
        !sectionTitle ||
        sectionTitle.length > 120 ||
        !body ||
        body.length > 5000 ||
        linkLabel.length > 80 ||
        linkTo.length > 200 ||
        ((linkLabel || linkTo) && (!linkLabel || !linkTo || !linkTo.startsWith("/") || linkTo.startsWith("//")))
      ) {
        return res.status(400).json({
          message: "Check each section title, content, and internal link. Links must be site paths such as /track-order.",
        });
      }
      normalizedSections.push({ title: sectionTitle, body, linkLabel, linkTo });
    }

    const page = await InfoPage.findOneAndUpdate(
      { slug },
      {
        $set: {
          title: title.trim(),
          intro: intro.trim(),
          sections: normalizedSections,
          updatedBy: req.user._id,
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json(page);
  } catch (error) {
    next(error);
  }
};
