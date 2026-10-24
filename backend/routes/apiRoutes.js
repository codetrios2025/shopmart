import express from "express";
import {
  register,
  login,
  googleLogin,
  getProfile,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import {
  getProducts,
  getProductById,
  getSellerProducts,
  getStoreCategories,
  createProduct,
} from "../controllers/productController.js";
import {
  createOrder,
  verifyPayment,
  getCustomerOrders,
  getSellerOrders,
} from "../controllers/orderController.js";
import {
  getAdminMetrics,
  getSellerMetrics,
} from "../controllers/dashboardController.js";
import {
  getActiveCoupons,
  validateCoupon,
} from "../controllers/couponController.js";
import { subscribeToNewsletter } from "../controllers/newsletterController.js";
import {
  confirmNewsletterUnsubscribe,
  unsubscribeFromNewsletter,
} from "../controllers/newsletterAdminController.js";
import { protect, authorizeRoles } from "../middleware/auth.js";
import { uploadProductImages } from "../middleware/productImageUpload.js";
import { uploadProfileImage } from "../middleware/profileImageUpload.js";
import { getStoreBanners } from "../controllers/bannerController.js";
import { createProductReview, getProductReviews } from "../controllers/reviewController.js";
import {
  addWishlistItem,
  createAddress,
  deleteAddress,
  getAddresses,
  getWishlist,
  removeWishlistItem,
} from "../controllers/customerController.js";
import { getPublicSpecialDeals } from "../controllers/specialDealController.js";
import { getPublicInfoPage } from "../controllers/infoPageController.js";

const router = express.Router();

// Auth Routes
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/google", googleLogin);
router.get("/auth/profile", protect, getProfile);
router.put("/auth/profile", protect, uploadProfileImage, updateProfile);
router.get("/customer/addresses", protect, authorizeRoles("customer"), getAddresses);
router.post("/customer/addresses", protect, authorizeRoles("customer"), createAddress);
router.delete(
  "/customer/addresses/:id",
  protect,
  authorizeRoles("customer"),
  deleteAddress,
);
router.get("/customer/wishlist", protect, authorizeRoles("customer"), getWishlist);
router.put(
  "/customer/wishlist/:productId",
  protect,
  authorizeRoles("customer"),
  addWishlistItem,
);
router.delete(
  "/customer/wishlist/:productId",
  protect,
  authorizeRoles("customer"),
  removeWishlistItem,
);
router.put("/auth/change-password", protect, changePassword);
router.post("/auth/forgot-password", requestPasswordReset);
router.post("/auth/reset-password", resetPassword);
router.post("/newsletter/subscribe", subscribeToNewsletter);
router.get("/newsletter/unsubscribe", confirmNewsletterUnsubscribe);
router.post("/newsletter/unsubscribe", unsubscribeFromNewsletter);

// Product Routes
router.get("/products", getProducts);
router.get("/special-deals", getPublicSpecialDeals);
router.get("/info-pages/:slug", getPublicInfoPage);
router.get("/products/:id/reviews", getProductReviews);
router.post(
  "/products/:id/reviews",
  protect,
  authorizeRoles("customer"),
  createProductReview,
);
router.get("/products/:id", getProductById);
router.get("/categories", getStoreCategories);
router.get("/banners", getStoreBanners);
router.get("/coupons/available", getActiveCoupons);
router.post(
  "/products",
  protect,
  authorizeRoles("seller", "admin"),
  uploadProductImages,
  createProduct,
);
router.get(
  "/products/seller/mine",
  protect,
  authorizeRoles("seller"),
  getSellerProducts,
);
router.get(
  "/orders/seller/mine",
  protect,
  authorizeRoles("seller"),
  getSellerOrders,
);

// Orders & Payment
router.post("/orders", protect, authorizeRoles("customer"), createOrder);
router.post("/orders/verify", protect, authorizeRoles("customer"), verifyPayment);
router.get("/orders/my-orders", protect, authorizeRoles("customer"), getCustomerOrders);
router.post(
  "/coupons/validate",
  validateCoupon,
);

// Dashboard Routes
router.get(
  "/dashboard/admin",
  protect,
  authorizeRoles("admin"),
  getAdminMetrics,
);
router.get(
  "/dashboard/seller",
  protect,
  authorizeRoles("seller"),
  getSellerMetrics,
);

export default router;
