import express from "express";
import {
  getAdminStats,
  getAllUsers,
  deleteUser,
  getAllSellers,
  approveSeller,
  updateUserStatus,
  getAllAdminProducts,
  bulkCreateAdminProducts,
  updateAdminProduct,
  deleteAdminProduct,
  getAllOrders,
  updateOrderStatus,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCoupons,
  createCoupon,
  toggleCouponStatus,
} from "../controllers/adminController.js";
import { protect, authorizeRoles } from "../middleware/auth.js";
import { uploadProductImages } from "../middleware/productImageUpload.js";
import {
  createBanner,
  deleteBanner,
  getAdminBanners,
  updateBanner,
} from "../controllers/bannerController.js";
import { uploadBannerImage } from "../middleware/bannerImageUpload.js";
import {
  createNewsletterCampaign,
  getNewsletterCampaigns,
  getNewsletterStatus,
  getNewsletterSubscribers,
} from "../controllers/newsletterAdminController.js";
import {
  createSpecialDeal,
  deleteSpecialDeal,
  getAdminSpecialDeals,
  toggleSpecialDeal,
  updateSpecialDeal,
} from "../controllers/specialDealController.js";
import {
  getAdminInfoPages,
  updateAdminInfoPage,
} from "../controllers/infoPageController.js";

const router = express.Router();

// Strict security: Authenticated + Role === 'admin'
router.use(protect, authorizeRoles("admin"));

router.get("/stats", getAdminStats);

// Users & Sellers
router.get("/users", getAllUsers);
router.delete("/users/:id", deleteUser);
router.put("/users/:id/status", updateUserStatus);
router.get("/sellers", getAllSellers);
router.put("/sellers/:id/approve", approveSeller);

// Products
router.get("/products", getAllAdminProducts);
router.post("/products/bulk", bulkCreateAdminProducts);
router.put("/products/:id", uploadProductImages, updateAdminProduct);
router.delete("/products/:id", deleteAdminProduct);

// Orders
router.get("/orders", getAllOrders);
router.put("/orders/:id/status", updateOrderStatus);

// Categories
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Coupons
router.get("/coupons", getCoupons);
router.post("/coupons", createCoupon);
router.put("/coupons/:id/toggle", toggleCouponStatus);

// Special deals
router.get("/special-deals", getAdminSpecialDeals);
router.post("/special-deals", createSpecialDeal);
router.put("/special-deals/:id", updateSpecialDeal);
router.put("/special-deals/:id/toggle", toggleSpecialDeal);
router.delete("/special-deals/:id", deleteSpecialDeal);

// Informational page content
router.get("/info-pages", getAdminInfoPages);
router.put("/info-pages/:slug", updateAdminInfoPage);

// Newsletter subscribers and campaigns
router.get("/newsletter/status", getNewsletterStatus);
router.get("/newsletter/subscribers", getNewsletterSubscribers);
router.get("/newsletter/campaigns", getNewsletterCampaigns);
router.post("/newsletter/campaigns", createNewsletterCampaign);

// Homepage promotion banners
router.get("/banners", getAdminBanners);
router.post("/banners", uploadBannerImage, createBanner);
router.put("/banners/:id", uploadBannerImage, updateBanner);
router.delete("/banners/:id", deleteBanner);

export default router;
