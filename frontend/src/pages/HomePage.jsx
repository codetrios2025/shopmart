import { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  ArrowRight,
  Clock3,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import api, { resolveMediaUrl } from "../api/client";
import WishlistButton from "../components/WishlistButton";

const bannerThemes = {
  indigo: {
    main: "bg-gradient-to-r from-blue-700 to-indigo-600",
    side: "bg-blue-50 border-blue-100",
    text: "text-blue-600",
  },
  blue: {
    main: "bg-gradient-to-r from-cyan-700 to-blue-600",
    side: "bg-sky-50 border-sky-100",
    text: "text-blue-600",
  },
  rose: {
    main: "bg-gradient-to-r from-pink-600 to-rose-500",
    side: "bg-pink-50 border-pink-100",
    text: "text-pink-600",
  },
  amber: {
    main: "bg-gradient-to-r from-amber-600 to-orange-500",
    side: "bg-amber-50 border-amber-100",
    text: "text-amber-700",
  },
  emerald: {
    main: "bg-gradient-to-r from-emerald-700 to-teal-500",
    side: "bg-emerald-50 border-emerald-100",
    text: "text-emerald-700",
  },
};

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [specialDeals, setSpecialDeals] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [banners, setBanners] = useState([]);
  const [bannerError, setBannerError] = useState("");
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [isBannerPaused, setIsBannerPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    let isMounted = true;
    api
      .get("/products", { params: { limit: 5 } })
      .then(({ data }) => {
        if (isMounted) setProducts(data.products || []);
      })
      .catch((error) =>
        isMounted &&
          setCatalogError(
            error.response?.data?.message ||
              "Products are temporarily unavailable.",
          ),
      );
    api
      .get("/special-deals")
      .then(({ data }) => {
        if (isMounted && Array.isArray(data)) setSpecialDeals(data);
      })
      .catch(() => {
        if (isMounted) setSpecialDeals([]);
      });
    api
      .get("/banners")
      .then(({ data }) => {
        if (!Array.isArray(data)) {
          throw new Error("Promotion data is unavailable.");
        }
        if (isMounted) {
          setBanners(
            data.filter(
              (banner) =>
                banner &&
                typeof banner._id === "string" &&
                typeof banner.title === "string" &&
                typeof banner.imageUrl === "string" &&
                (banner.placement === "main" || banner.placement === "side"),
            ),
          );
        }
      })
      .catch(() => {
        if (isMounted) {
          setBannerError("Promotions are temporarily unavailable.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const currentBannerIndex = banners.length
    ? activeBannerIndex % banners.length
    : 0;
  const activeBanner = banners[currentBannerIndex];

  useEffect(() => {
    if (banners.length < 2 || isBannerPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, isBannerPaused]);

  const moveBanner = (offset) => {
    setActiveBannerIndex(
      (current) => (current + offset + banners.length) % banners.length,
    );
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <Header />

      <section
        aria-label="Store promotions"
        aria-roledescription="carousel"
        className="mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-6 sm:pt-10 lg:px-8"
      >
        {activeBanner ? (
          <div className="relative">
            <article
              role="group"
              aria-roledescription="slide"
              aria-label={`${currentBannerIndex + 1} of ${banners.length}: ${activeBanner.title}`}
              className={`group relative isolate flex min-h-[300px] items-end overflow-hidden rounded-[2rem] ${
                (bannerThemes[activeBanner.theme] || bannerThemes.indigo).main
              } p-6 text-white shadow-xl shadow-slate-900/10 sm:min-h-[400px] sm:p-10 lg:min-h-[460px]`}
            >
              <img
                key={activeBanner._id}
                src={resolveMediaUrl(activeBanner.imageUrl)}
                alt={activeBanner.imageAlt || ""}
                className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/85 via-slate-900/55 to-slate-900/5" />
              <div className="max-w-xl pb-12 sm:pb-8">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  {activeBanner.eyebrow}
                </span>
                <h1 className="mt-5 max-w-lg text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  {activeBanner.title}
                </h1>
                {activeBanner.description && (
                  <p className="mt-4 max-w-md text-sm leading-6 text-white/80 sm:text-base">
                    {activeBanner.description}
                  </p>
                )}
                <Link
                  to={activeBanner.link}
                  className="mt-7 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-100"
                >
                  {activeBanner.buttonLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <span className="absolute bottom-6 right-7 hidden text-xs font-medium tracking-wide text-white/65 sm:block">
                SHOPMART · CURATED FOR YOU
              </span>
            </article>
            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={isBannerPaused ? "Resume promotion rotation" : "Pause promotion rotation"}
                  aria-pressed={isBannerPaused}
                  onClick={() => setIsBannerPaused((paused) => !paused)}
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-slate-900/40 text-white backdrop-blur transition hover:bg-slate-900/70 sm:right-5 sm:top-5"
                >
                  {isBannerPaused ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Previous promotion"
                  onClick={() => moveBanner(-1)}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/90 text-slate-900 shadow-lg transition hover:bg-white sm:left-5"
                >
                  <ArrowRight className="h-5 w-5 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label="Next promotion"
                  onClick={() => moveBanner(1)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/50 bg-white/90 text-slate-900 shadow-lg transition hover:bg-white sm:right-5"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
                <div
                  className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2"
                  role="group"
                  aria-label="Choose promotion"
                >
                  {banners.map((banner, index) => (
                    <button
                      key={banner._id}
                      type="button"
                      aria-label={`Show promotion ${index + 1}: ${banner.title}`}
                      aria-current={index === currentBannerIndex ? "true" : undefined}
                      onClick={() => setActiveBannerIndex(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentBannerIndex
                          ? "w-7 bg-white"
                          : "w-2 bg-white/55 hover:bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-[250px] flex-col items-start justify-center rounded-[2rem] bg-slate-900 px-6 py-10 text-white shadow-xl shadow-slate-900/10 sm:min-h-[300px] sm:px-12">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              <Sparkles className="h-4 w-4" />
              Discover Shopmart
            </span>
            <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Find something you’ll love.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
              Explore the latest products and discover your next everyday
              favorite.
            </p>
            <Link
              to="/category"
              className="mt-6 inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-sky-100"
            >
              Explore the collection
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
      {bannerError && (
        <p role="status" className="mx-auto max-w-7xl px-4 text-xs text-amber-700 sm:px-6 lg:px-8">
          {bannerError}
        </p>
      )}

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-sm md:grid-cols-4">
          <div className="flex items-center gap-3 bg-white p-4 sm:p-5">
            <Truck className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-bold text-slate-900 sm:text-sm">Free Delivery</p>
              <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">On all orders</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 sm:p-5">
            <RotateCcw className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-bold text-slate-900 sm:text-sm">7 Days Return</p>
              <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Easy return &amp; refund</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 sm:p-5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-bold text-slate-900 sm:text-sm">Secure Payment</p>
              <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Secure checkout</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white p-4 sm:p-5">
            <Headphones className="h-5 w-5 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-bold text-slate-900 sm:text-sm">Customer Support</p>
              <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Here to help you</p>
            </div>
          </div>
        </div>
      </section>

      {specialDeals.length > 0 && (
        <section
          aria-labelledby="special-deals-heading"
          className="mx-auto max-w-7xl px-4 pb-7 pt-5 sm:px-6 lg:px-8"
        >
          <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-xl shadow-slate-900/10 sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Handpicked savings
                </p>
                <h2
                  id="special-deals-heading"
                  className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl"
                >
                  Special deals
                </h2>
                <p className="mt-1 text-xs text-slate-300 sm:text-sm">
                  Limited-time prices, selected just for you.
                </p>
              </div>
              <Link
                to="/category"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Shop all products
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {specialDeals.map((deal) => {
                const item = deal.product;
                if (!item) return null;
                return (
                  <Link
                    key={deal._id}
                    to={`/product/${item._id}`}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.1]"
                  >
                    <div className="relative overflow-hidden bg-white">
                      <img
                        src={item.images?.[0]}
                        alt={item.title}
                        className="h-36 w-full object-contain transition duration-300 group-hover:scale-[1.04] sm:h-48"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-extrabold text-white shadow sm:left-3 sm:top-3 sm:text-xs">
                        {deal.discountPercentage}% OFF
                      </span>
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        {deal.title}
                      </p>
                      <h3 className="mt-1 truncate text-xs font-semibold text-white sm:text-sm">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-extrabold text-white sm:text-base">
                          ₹{Number(item.dealPrice).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          ₹{Number(item.price).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock3 className="h-3 w-3" />
                        Ends {new Date(deal.endsAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-14 pt-7 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
              The shopmart edit
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Featured products
            </h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              A few finds we think you’ll love.
            </p>
          </div>
          <Link
            to="/category"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline sm:text-sm"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {products.map((item) => {
            const currentPrice = Number(item.dealPrice ?? item.price);
            const originalPrice = Number(item.originalPrice || item.price);
            const discount = item.activeSpecialDeal
              ? Number(item.activeSpecialDeal.discountPercentage)
              : originalPrice > currentPrice
                ? Math.max(
                    1,
                    Math.round((1 - currentPrice / originalPrice) * 100),
                  )
                : 0;
            return (
              <article
                key={item._id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg sm:p-4"
              >
                <WishlistButton
                  product={item}
                  className="absolute right-5 top-5 z-10"
                />
                <Link to={`/product/${item._id}`} className="block">
                  <img
                    src={item.images?.[0]}
                    alt={item.title}
                    className="mb-3 h-36 w-full rounded-xl bg-slate-50 object-contain transition duration-300 group-hover:scale-[1.03] sm:h-44"
                  />
                  <p className="truncate text-xs font-semibold text-slate-700 sm:text-sm">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-extrabold text-slate-900 sm:text-base">
                      ₹{currentPrice.toLocaleString("en-IN")}
                    </span>
                    {item.activeSpecialDeal ? (
                      <span className="text-[10px] text-slate-400 line-through">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </span>
                    ) : originalPrice > currentPrice ? (
                      <span className="text-[10px] text-slate-400 line-through">
                        ₹{originalPrice.toLocaleString("en-IN")}
                      </span>
                    ) : null}
                    {discount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        {discount}% OFF
                      </span>
                    )}
                  </div>
                </Link>
              </article>
            );
          })}
          {!products.length && (
            <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              {catalogError || "No products are listed yet."}
            </p>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
