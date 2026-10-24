import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  CreditCard,
  Copy,
  Heart,
  RotateCcw,
  Share2,
  ShieldCheck,
  Truck,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../api/client";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { showToast } from "../utils/toast";

const emptyImageList = [];

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isSaved, toggle: toggleWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [wishlistError, setWishlistError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponLoadError, setCouponLoadError] = useState("");
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [applyingCouponCode, setApplyingCouponCode] = useState("");
  const colorImageGroup = useMemo(
    () =>
      product?.colorImages?.find(
        (group) => group.color === selectedColor && group.images?.length,
      ),
    [product, selectedColor],
  );
  const sharedImages = useMemo(
    () =>
      product?.images?.filter(
        (image) =>
          !product.colorImages?.some((group) => group.images?.includes(image)),
      ) || emptyImageList,
    [product],
  );
  const hasColorSpecificImages = Boolean(
    product?.colorImages?.some((group) => group.images?.length),
  );
  const displayedImages = useMemo(
    () =>
      colorImageGroup?.images?.length
        ? [...colorImageGroup.images, ...sharedImages]
        : hasColorSpecificImages
          ? sharedImages
          : product?.images || emptyImageList,
    [colorImageGroup, hasColorSpecificImages, product, sharedImages],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get(`/products/${id}`)
      .then(({ data }) => {
        if (!active) return;
        setProduct(data);
        setSelectedSize(data.sizes?.[0] || "");
        setSelectedColor(data.colors?.[0] || "");
        setSelectedImage(
          data.colorImages?.find(
            (group) => group.color === data.colors?.[0] && group.images?.length,
          )?.images?.[0] ||
            data.images?.[0] ||
            "",
        );
        setAppliedCoupon(null);
        setCouponError("");
      })
      .catch((requestError) => {
        if (active)
          setError(
            requestError.response?.data?.message || "Unable to load this product.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    api
      .get("/coupons/available")
      .then(({ data }) => {
        if (active) setAvailableCoupons(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (active) {
          setCouponLoadError(
            requestError.response?.data?.message ||
              "Available coupons could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!zoomOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setZoomOpen(false);
      if (event.key === "+" || event.key === "=") {
        setZoomLevel((current) => Math.min(4, current + 0.25));
      }
      if (event.key === "-") {
        setZoomLevel((current) => Math.max(1, current - 0.25));
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const images = displayedImages;
        const currentIndex = images.indexOf(selectedImage);
        if (!images.length) return;
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + direction + images.length) % images.length;
        setSelectedImage(images[nextIndex]);
        setZoomLevel(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zoomOpen, displayedImages, selectedImage]);

  useEffect(() => {
    if (!shareOpen) return undefined;
    const closeShareMenu = (event) => {
      if (event.key === "Escape") setShareOpen(false);
    };
    document.addEventListener("keydown", closeShareMenu);
    return () => document.removeEventListener("keydown", closeShareMenu);
  }, [shareOpen]);

  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    api
      .get(`/products/${id}/reviews`)
      .then(({ data }) => {
        if (active) setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      })
      .catch((requestError) => {
        if (active) {
          setReviewError(
            requestError.response?.data?.message || "Unable to load reviews.",
          );
        }
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const addToCart = () => {
    addItem(product, { size: selectedSize, color: selectedColor });
    navigate("/cart");
  };

  const getCurrentProductPrice = () =>
    Number(product?.dealPrice ?? product?.price ?? 0);

  const applyProductCoupon = async (code) => {
    setApplyingCouponCode(code);
    setCouponError("");
    try {
      const { data } = await api.post("/coupons/validate", {
        code,
        subtotal: getCurrentProductPrice(),
      });
      setAppliedCoupon({
        code: data.code,
        discountAmount: data.discountAmount,
        finalPrice: data.finalSubtotal,
      });
    } catch (requestError) {
      setAppliedCoupon(null);
      setCouponError(
        requestError.response?.data?.message || "Unable to apply this coupon.",
      );
    } finally {
      setApplyingCouponCode("");
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setSubmittingReview(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const { data } = await api.post(`/products/${id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviews((current) => [data.review, ...current]);
      setProduct((current) => ({
        ...current,
        rating: data.rating,
        numReviews: data.numReviews,
      }));
      setReviewComment("");
      setReviewNotice("Thanks! Your verified-purchase review has been posted.");
    } catch (requestError) {
      setReviewError(
        requestError.response?.data?.message || "Unable to submit your review.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleWishlistToggle = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    setWishlistError("");
    try {
      await toggleWishlist(product);
    } catch (requestError) {
      setWishlistError(requestError.message);
    }
  };

  const openImageZoom = () => {
    setZoomLevel(1);
    setZoomOpen(true);
  };

  const changeZoom = (amount) => {
    setZoomLevel((current) =>
      Math.min(4, Math.max(1, Math.round((current + amount) * 100) / 100)),
    );
  };

  const productShareUrl = `${window.location.origin}/product/${id}`;
  const productShareText = `${product?.title || "SHOPMART product"} - check it out on SHOPMART`;
  const productShareLinks = [
    {
      name: "Email",
      label: "email",
      url: `mailto:?subject=${encodeURIComponent(product?.title || "SHOPMART product")}&body=${encodeURIComponent(`${productShareText}\n${productShareUrl}`)}`,
      className: "text-slate-700",
    },
    {
      name: "Pinterest",
      label: "P",
      url: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(productShareUrl)}&media=${encodeURIComponent(selectedImage || product?.images?.[0] || "")}&description=${encodeURIComponent(productShareText)}`,
      className: "font-bold text-[#bd081c]",
    },
    {
      name: "Facebook",
      label: "f",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productShareUrl)}`,
      className: "font-bold text-[#1877f2]",
    },
    {
      name: "X",
      label: "X",
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(productShareUrl)}&text=${encodeURIComponent(productShareText)}`,
      className: "font-bold text-slate-800",
    },
  ];

  const copyProductLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(productShareUrl);
      } else {
        const copyField = document.createElement("textarea");
        copyField.value = productShareUrl;
        copyField.setAttribute("readonly", "");
        copyField.style.position = "fixed";
        copyField.style.opacity = "0";
        document.body.appendChild(copyField);
        try {
          copyField.select();
          if (!document.execCommand("copy")) {
            throw new Error("Clipboard copy was rejected");
          }
        } finally {
          copyField.remove();
        }
      }
      showToast("Product link copied. Share it with your friends!", "success");
    } catch {
      showToast(
        "Unable to copy the product link. Please copy it from your address bar.",
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="max-w-7xl mx-auto w-full px-4 py-8 flex-1">
        {loading ? (
          <p className="py-20 text-center text-gray-500">Loading product...</p>
        ) : error ? (
          <div className="rounded-xl bg-white border p-8 text-center">
            <p role="alert" className="text-red-700">{error}</p>
            <Link to="/category" className="inline-block mt-4 text-blue-600">
              Back to products
            </Link>
          </div>
        ) : product ? (
          <>
          <article className="bg-white border rounded-2xl p-5 md:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="relative flex flex-col-reverse gap-3 sm:flex-row">
                <div className="flex sm:flex-col gap-2 overflow-auto">
                  {displayedImages.map((image) => (
                    <button
                      key={image}
                      onClick={() => setSelectedImage(image)}
                      className={`shrink-0 border rounded-lg overflow-hidden ${selectedImage === image ? "border-blue-600" : ""}`}
                    >
                      <img src={image} alt="" className="w-16 h-16 object-cover" />
                    </button>
                  ))}
                </div>
                <div className="absolute right-3 top-3 z-10 flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setShareOpen((open) => !open)}
                    aria-label="Share product"
                    aria-expanded={shareOpen}
                    aria-haspopup="dialog"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-md transition hover:-translate-y-0.5 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  {shareOpen && (
                    <div
                      role="dialog"
                      aria-label="Share product links"
                      className="absolute right-0 top-12 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                        <span className="text-xs font-semibold text-gray-500">
                          Share product
                        </span>
                        <button
                          type="button"
                          onClick={() => setShareOpen(false)}
                          aria-label="Close share menu"
                          className="rounded p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {productShareLinks.map(({ name, label, url, className }) => (
                        <a
                          key={name}
                          href={url}
                          target={name === "Email" ? undefined : "_blank"}
                          rel={name === "Email" ? undefined : "noopener noreferrer"}
                          onClick={() => setShareOpen(false)}
                          className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-sm text-gray-800 transition last:border-b-0 hover:bg-gray-50"
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-6 w-6 items-center justify-center ${
                              name === "Email" ? "" : "rounded-full"
                            } ${className}`}
                          >
                            {name === "Email" ? (
                              <Mail className="h-4 w-4" />
                            ) : (
                              label
                            )}
                          </span>
                          {name}
                        </a>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setShareOpen(false);
                          copyProductLink();
                        }}
                        className="flex w-full items-center gap-3 border-t border-gray-100 px-3 py-2.5 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                      >
                        <Copy className="ml-1 h-4 w-4" aria-hidden="true" />
                        Copy Link
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleWishlistToggle}
                    aria-label={
                      isSaved(product._id)
                        ? "Remove from wishlist"
                        : "Add to wishlist"
                    }
                    title={
                      isSaved(product._id)
                        ? "Remove from wishlist"
                        : "Add to wishlist"
                    }
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-md transition hover:-translate-y-0.5 ${
                      isSaved(product._id)
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-gray-200 bg-white text-gray-500 hover:text-rose-600"
                    }`}
                  >
                    <Heart
                      className="h-5 w-5"
                      fill={isSaved(product._id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openImageZoom}
                  aria-label="Open product image zoom"
                  className="group relative min-w-0 flex-1 cursor-zoom-in overflow-hidden rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <img
                    src={selectedImage}
                    alt={product.title}
                    className="h-96 w-full rounded-xl object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {Number(product.discountPercentage) > 0 && (
                    <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow">
                      {Number(product.specialDiscountPercentage) ||
                        Number(product.discountPercentage)}
                      % OFF
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-full bg-white/90 p-2 text-gray-700 opacity-0 shadow transition group-hover:opacity-100 group-focus:opacity-100">
                    <ZoomIn className="h-4 w-4" />
                  </span>
                </button>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-600">{product.brand}</p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900">
                  {product.title}
                </h1>
                {wishlistError && (
                  <p role="alert" className="mt-2 text-xs text-red-600">
                    {wishlistError}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  ★ {product.numReviews ? Number(product.rating).toFixed(1) : "New"} (
                  {product.numReviews || 0} reviews)
                </p>
                <div className="flex items-baseline gap-3 mt-5">
                  <span className="text-2xl font-black">
                    ₹{getCurrentProductPrice().toLocaleString("en-IN")}
                  </span>
                  {product.activeSpecialDeal ? (
                    <>
                      <span className="text-sm text-gray-400 line-through">
                        ₹{Number(product.price).toLocaleString("en-IN")}
                      </span>
                      <span className="text-sm font-bold text-rose-600">
                        {product.activeSpecialDeal.discountPercentage}% special deal
                      </span>
                    </>
                  ) : Number(product.originalPrice) > Number(product.price) ? (
                    <>
                      <span className="line-through text-gray-400">
                        ₹{product.originalPrice.toLocaleString("en-IN")}
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        {Math.max(
                          1,
                          Math.round(
                            (1 -
                              Number(product.price) /
                                Number(product.originalPrice)) *
                              100,
                          ),
                        )}
                        % off
                      </span>
                    </>
                  ) : null}
                </div>
                {product.activeSpecialDeal && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                    <Clock3 className="h-3.5 w-3.5" />
                    {product.activeSpecialDeal.title} · ends{" "}
                    {new Date(product.activeSpecialDeal.endsAt).toLocaleDateString("en-IN")}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">Inclusive of all taxes</p>
                {(availableCoupons.length > 0 || couponLoadError) && (
                  <section
                    aria-label="Available coupon discounts"
                    className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-lg text-amber-700">
                        %
                      </span>
                      <h2 className="text-sm font-bold text-gray-900">
                        Coupon discounts
                      </h2>
                    </div>
                    {couponLoadError ? (
                      <p role="alert" className="mt-2 text-xs text-red-600">
                        {couponLoadError}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {availableCoupons.map((coupon) => {
                          const isApplied = appliedCoupon?.code === coupon.code;
                          return (
                            <div
                              key={coupon._id || coupon.code}
                              className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/70 pt-3 first:border-0 first:pt-0"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800">
                                  Coupon discount{" "}
                                  <span className="rounded bg-green-200 px-1.5 py-0.5 text-green-900">
                                    Save {coupon.discountPercentage}%
                                  </span>{" "}
                                  now
                                </p>
                                <p className="mt-1 text-xs text-gray-600">
                                  Use{" "}
                                  <span className="font-mono font-bold text-blue-700">
                                    {coupon.code}
                                  </span>
                                  {coupon.minOrderAmount > 0 &&
                                    ` · Minimum order ${new Intl.NumberFormat("en-IN", {
                                      style: "currency",
                                      currency: "INR",
                                      maximumFractionDigits: 0,
                                    }).format(coupon.minOrderAmount)}`}
                                  {coupon.maxDiscountAmount > 0 &&
                                    ` · Up to ${new Intl.NumberFormat("en-IN", {
                                      style: "currency",
                                      currency: "INR",
                                      maximumFractionDigits: 0,
                                    }).format(coupon.maxDiscountAmount)} off`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => applyProductCoupon(coupon.code)}
                                disabled={Boolean(applyingCouponCode)}
                                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                                  isApplied
                                    ? "border-green-600 bg-green-600 text-white"
                                    : "border-gray-400 bg-white text-gray-800 hover:border-blue-600 hover:text-blue-700"
                                }`}
                              >
                                {applyingCouponCode === coupon.code
                                  ? "Applying..."
                                  : isApplied
                                    ? "Applied"
                                    : "Apply coupon"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {couponError && (
                      <p role="alert" className="mt-3 text-xs font-medium text-red-700">
                        {couponError}
                      </p>
                    )}
                    {appliedCoupon && (
                      <>
                        <div className="mt-3 flex items-baseline justify-between border-t border-amber-200 pt-3 text-sm">
                          <span className="text-gray-700">
                            Price with {appliedCoupon.code}
                          </span>
                          <span className="font-bold text-green-700">
                            {new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 2,
                            }).format(appliedCoupon.finalPrice)}
                            <span className="ml-2 text-xs font-medium text-gray-500">
                              (you save ₹{Number(appliedCoupon.discountAmount).toLocaleString("en-IN")})
                            </span>
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">
                          Cart and checkout totals are recalculated for your full order.
                        </p>
                      </>
                    )}
                  </section>
                )}
                {!!product.colors?.length && (
                  <fieldset className="mt-6">
                    <legend className="text-sm font-semibold">Color: {selectedColor}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setSelectedColor(color);
                            const colorImages = product.colorImages?.find(
                              (group) => group.color === color && group.images?.length,
                            )?.images;
                            const sharedImage = product.images?.find(
                              (image) =>
                                !product.colorImages?.some((group) =>
                                  group.images?.includes(image),
                                ),
                            );
                            setSelectedImage(
                              colorImages?.[0] ||
                                sharedImage ||
                                product.images?.[0] ||
                                "",
                            );
                            setZoomLevel(1);
                          }}
                          aria-pressed={selectedColor === color}
                          className={`w-[76px] overflow-hidden rounded-lg border bg-white text-left transition ${
                            selectedColor === color
                              ? "border-blue-600 ring-2 ring-blue-100"
                              : "border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          <img
                            src={
                              product.colorImages?.find(
                                (group) => group.color === color && group.images?.length,
                              )?.images?.[0] ||
                              product.images?.find(
                                (image) =>
                                  !product.colorImages?.some((group) =>
                                    group.images?.includes(image),
                                  ),
                              ) ||
                              product.images?.[0]
                            }
                            alt=""
                            className="h-[76px] w-full object-cover"
                          />
                          <span className="block truncate px-1.5 py-1 text-center text-[11px] font-medium text-gray-700">
                            {color}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {!!product.sizes?.length && (
                  <fieldset className="mt-5">
                    <legend className="text-sm font-semibold">Size</legend>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {product.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-10 rounded-lg border px-3 py-2 text-sm ${selectedSize === size ? "bg-blue-600 text-white" : ""}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p className="text-sm text-gray-600 mt-5">
                  {product.stock > 0 ? `${product.stock} available` : "Out of stock"}
                </p>
                <div className="flex gap-3 mt-5">
                  <button
                    disabled={
                      !product.stock ||
                      (product.sizes?.length > 0 && !selectedSize) ||
                      (product.colors?.length > 0 && !selectedColor)
                    }
                    onClick={addToCart}
                    className="flex-1 rounded-lg border border-blue-600 py-3 font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Add to cart
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-gray-600 mt-6">
                  {product.description}
                </p>
                <div className="grid grid-cols-2 gap-3 mt-6 border-t pt-5 text-xs text-gray-600">
                  <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-blue-600" /> Delivery available</div>
                  <div className="flex items-center gap-2"><RotateCcw className="w-4 h-4 text-blue-600" /> Easy returns</div>
                  <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-blue-600" /> Quality assured</div>
                  <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Secure checkout</div>
                </div>
              </div>
            </div>
          </article>
          <section className="mt-6 rounded-2xl border bg-white p-5 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Customer reviews
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {product.numReviews
                    ? `${Number(product.rating).toFixed(1)} out of 5 · ${product.numReviews} verified review${product.numReviews === 1 ? "" : "s"}`
                    : "Be the first to review this product after purchase."}
                </p>
              </div>
              <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                Verified purchases
              </span>
            </div>

            {user?.role === "customer" ? (
              <form onSubmit={submitReview} className="mt-5 rounded-xl bg-gray-50 p-4">
                <h3 className="font-semibold text-gray-900">Write a review</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Reviews are limited to customers with a completed order for this product.
                </p>
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-gray-700">
                    Your rating
                  </legend>
                  <div className="mt-1 flex gap-1" role="group" aria-label="Choose rating">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setReviewRating(rating)}
                        aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                        aria-pressed={reviewRating === rating}
                        className={`text-2xl ${
                          rating <= reviewRating ? "text-amber-500" : "text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-3 block text-sm font-medium text-gray-700">
                  Your review
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    placeholder="What did you think about this product?"
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                  />
                  <span className="mt-1 block text-right text-xs font-normal text-gray-500">
                    {reviewComment.length}/1000
                  </span>
                </label>
                {reviewError && (
                  <p role="alert" className="mt-3 text-sm text-red-700">
                    {reviewError}
                  </p>
                )}
                {reviewNotice && (
                  <p role="status" className="mt-3 text-sm text-green-700">
                    {reviewNotice}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="mt-3 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submittingReview ? "Submitting..." : "Submit review"}
                </button>
              </form>
            ) : !user ? (
              <p className="mt-5 text-sm text-gray-600">
                <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                  Sign in
                </Link>{" "}
                as a customer to write a verified-purchase review.
              </p>
            ) : null}

            <div className="mt-5 divide-y">
              {reviewError && !user && (
                <p role="alert" className="py-3 text-sm text-red-700">
                  {reviewError}
                </p>
              )}
              {reviewsLoading ? (
                <p className="py-6 text-sm text-gray-500">Loading reviews...</p>
              ) : reviews.length ? (
                reviews.map((review) => (
                  <article key={review._id} className="py-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">
                        {review.customerName}
                      </p>
                      <time
                        dateTime={review.createdAt}
                        className="text-xs text-gray-500"
                      >
                        {new Date(review.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                    <p
                      className="mt-1 text-sm text-amber-500"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {"★".repeat(review.rating)}
                      <span className="text-gray-300">
                        {"★".repeat(5 - review.rating)}
                      </span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {review.comment}
                    </p>
                  </article>
                ))
              ) : (
                !reviewsLoading && (
                  <p className="py-6 text-sm text-gray-500">
                    No reviews yet.
                  </p>
                )
              )}
            </div>
          </section>
          </>
        ) : null}
      </main>
      <Footer />
      {zoomOpen && product && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product image viewer"
          className="fixed inset-0 z-[120] flex flex-col bg-black/95 p-3 text-white sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setZoomOpen(false);
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4">
            <p className="min-w-0 truncate text-sm font-medium text-white/80">
              {product.title}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeZoom(-0.25)}
                disabled={zoomLevel <= 1}
                aria-label="Zoom out"
                title="Zoom out"
                className="rounded-lg border border-white/20 p-2 hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                aria-label="Reset zoom"
                title="Reset zoom"
                className="min-w-14 rounded-lg border border-white/20 px-2 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() => changeZoom(0.25)}
                disabled={zoomLevel >= 4}
                aria-label="Zoom in"
                title="Zoom in"
                className="rounded-lg border border-white/20 p-2 hover:bg-white/10 disabled:opacity-40"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                aria-label="Close image viewer"
                title="Close"
                className="ml-2 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 overflow-hidden py-4">
            {displayedImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = displayedImages.indexOf(selectedImage);
                  setSelectedImage(
                    displayedImages[
                      (currentIndex - 1 + displayedImages.length) %
                        displayedImages.length
                    ],
                  );
                  setZoomLevel(1);
                }}
                aria-label="Previous product image"
                className="z-10 rounded-full bg-white/10 p-2 hover:bg-white/20 sm:p-3"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <div className="flex h-full min-w-0 flex-1 items-center justify-center overflow-auto">
              <img
                src={selectedImage}
                alt={product.title}
                draggable="false"
                className="max-h-full max-w-full select-none object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            {displayedImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = displayedImages.indexOf(selectedImage);
                  setSelectedImage(
                    displayedImages[
                      (currentIndex + 1) % displayedImages.length
                    ],
                  );
                  setZoomLevel(1);
                }}
                aria-label="Next product image"
                className="z-10 rounded-full bg-white/10 p-2 hover:bg-white/20 sm:p-3"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>
          <p className="shrink-0 text-center text-xs text-white/50">
            Use + / − to zoom · Arrow keys to change image · Esc to close
          </p>
        </div>
      )}
    </div>
  );
}
