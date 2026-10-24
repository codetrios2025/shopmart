import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardList,
  LayoutDashboard,
  ImagePlus,
  Package,
  RefreshCw,
  Settings,
  Store,
  Trash2,
  UploadCloud,
  Wallet,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../api/client";
import AccountSecurity from "../components/AccountSecurity";
import ProfileSettings from "../components/ProfileSettings";
import { useAuth } from "../context/AuthContext";
import ListPagination from "../components/ListPagination";
import { hasCompleteColorImageAssignments } from "../utils/productImages";

const emptyForm = {
  title: "",
  category: "",
  brand: "",
  description: "",
  price: "",
  originalPrice: "",
  stock: "",
  sizes: "",
  colors: "",
};

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const fetchSellerData = () =>
  Promise.all([
    api.get("/dashboard/seller"),
    api.get("/products/seller/mine"),
  ]);

export default function SellerDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersPagination, setOrdersPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const previewUrls = useRef(new Set());
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [productImages, setProductImages] = useState([]);
  const [productImageColors, setProductImageColors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const clearImagePreviews = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  };

  useEffect(
    () => () => {
      clearImagePreviews();
    },
    [],
  );

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [metricsResponse, productsResponse] = await fetchSellerData();
      setMetrics(metricsResponse.data);
      setProducts(productsResponse.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to load seller data.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchSellerData()
      .then(([metricsResponse, productsResponse]) => {
        if (!active) return;
        setMetrics(metricsResponse.data);
        setProducts(productsResponse.data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message || "Unable to load seller data.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "orders") return undefined;
    let active = true;
    setOrdersLoading(true);
    setOrdersError("");
    api
      .get("/orders/seller/mine", {
        params: {
          page: ordersPagination.page,
          limit: ordersPagination.limit,
        },
      })
      .then(({ data }) => {
        if (!active) return;
        setOrders(data.orders);
        setOrdersPagination(data.pagination);
      })
      .catch((requestError) => {
        if (active) {
          setOrdersError(
            requestError.response?.data?.message || "Unable to load your orders.",
          );
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTab, ordersPagination.page, ordersPagination.limit]);

  const sellerTabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ClipboardList },
    { id: "profile", label: "Profile & security", icon: Settings },
  ];

  const handleImageSelection = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length > 6) {
      setError("Choose up to 6 product images.");
      event.target.value = "";
      return;
    }
    const invalidFile = files.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          file.type,
        ),
    );
    if (invalidFile) {
      setError("Product images must be JPEG, PNG, WebP, or GIF files.");
      event.target.value = "";
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each product image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    clearImagePreviews();
    setError("");
    setProductImages(
      files.map((file) => {
        const preview = URL.createObjectURL(file);
        previewUrls.current.add(preview);
        return { file, preview };
      }),
    );
    setProductImageColors(
      files.map((_, index) => productImageColors[index] || ""),
    );
  };

  const removeProductImage = (preview) => {
    URL.revokeObjectURL(preview);
    previewUrls.current.delete(preview);
    setProductImages((current) =>
      current.filter((image) => image.preview !== preview),
    );
    setProductImageColors((current) =>
      current.filter((_, index) => productImages[index]?.preview !== preview),
    );
  };

  const createProduct = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!productImages.length) {
      setError("Upload at least one product image before publishing.");
      return;
    }
    const price = Number(form.price);
    const originalPrice = Number(form.originalPrice);
    if (originalPrice < price) {
      setError("Original price must be equal to or greater than selling price.");
      return;
    }
    const colors = form.colors
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      productImageColors.some((color) => color && !colors.includes(color))
    ) {
      setError("Each color-assigned image must match an available product color.");
      return;
    }
    if (!hasCompleteColorImageAssignments(colors, productImageColors)) {
      setError("Assign at least one image to every product color, or leave an image shared across all colors.");
      return;
    }

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("category", form.category.trim());
    payload.append("brand", form.brand.trim());
    payload.append("description", form.description.trim());
    payload.append("price", String(price));
    payload.append("originalPrice", String(originalPrice));
    payload.append("stock", String(Number(form.stock)));
    payload.append(
      "sizes",
      JSON.stringify(
        form.sizes.split(",").map((value) => value.trim()).filter(Boolean),
      ),
    );
    payload.append(
      "colors",
      JSON.stringify(
        form.colors.split(",").map((value) => value.trim()).filter(Boolean),
      ),
    );
    payload.append(
      "colorImageSelections",
      JSON.stringify(
        productImageColors
          .map((color, imageIndex) => ({ color, imageIndex }))
          .filter((selection) => selection.color),
      ),
    );
    productImages.forEach(({ file }) => payload.append("images", file));

    setSaving(true);
    try {
      const { data } = await api.post("/products", payload);
      setProducts((current) => [data, ...current]);
      setForm(emptyForm);
      clearImagePreviews();
      setProductImages([]);
      setProductImageColors([]);
      event.target.reset();
      setNotice("Your product has been published successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to create product.",
      );
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    {
      label: "Total orders",
      value: metrics?.totalOrders ?? 0,
      icon: Package,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Total sales",
      value: currency(metrics?.totalSales),
      icon: Wallet,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Estimated earnings",
      value: currency(metrics?.totalEarnings),
      icon: ArrowUpRight,
      color: "bg-violet-50 text-violet-700",
    },
    {
      label: "Pending orders",
      value: metrics?.pendingOrders ?? 0,
      icon: RefreshCw,
      color: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header roleTag="Seller" />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-slate-100 px-3 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Seller account
            </p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900">
              {user?.name}
            </p>
            {user?.sellerCode && (
              <p className="mt-1 text-[11px] font-semibold text-blue-700">
                {user.sellerCode}
              </p>
            )}
          </div>
          <nav aria-label="Seller dashboard" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {sellerTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  activeTab === id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-lg sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
                <Store className="h-4 w-4" />
                Seller workspace
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Seller dashboard
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300">
                Manage your product catalog, monitor sales, and keep your store
                moving.
              </p>
              {user?.sellerCode && (
                <p className="mt-3 inline-flex rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                  Seller code: {user.sellerCode}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setError("");
                loadData();
              }}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh data
            </button>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}
        {location.state?.accountNotice && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            {location.state.accountNotice}
          </p>
        )}

        {activeTab === "overview" && <section
          aria-label="Store performance"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <span className={`rounded-xl p-2.5 ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {loading ? "—" : value}
              </p>
              <p className="mt-1 text-xs text-slate-400">Store overview</p>
            </article>
          ))}
        </section>}

        {activeTab === "products" && <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.6fr)]">
          <form
            onSubmit={createProduct}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                Product catalog
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                List a product
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add clear details and up to six product photos.
              </p>
            </div>
            <div className="space-y-4">
              {[
                ["title", "Product title", "text"],
                ["category", "Category", "text"],
                ["brand", "Brand", "text"],
                ["price", "Selling price (₹)", "number"],
                ["originalPrice", "Original price (₹)", "number"],
                ["stock", "Stock quantity", "number"],
              ].map(([field, label, type]) => (
                <label
                  key={field}
                  className="block text-sm font-medium text-slate-700"
                >
                  {label}
                  <input
                    required
                    type={type}
                    min={
                      ["price", "originalPrice"].includes(field)
                        ? "0.01"
                        : field === "stock"
                          ? "0"
                          : undefined
                    }
                    step={["price", "originalPrice"].includes(field) ? "0.01" : undefined}
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
              ))}

              <label className="block text-sm font-medium text-slate-700">
                Product images
                <span className="mt-1.5 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/50">
                  <UploadCloud className="h-7 w-7 text-blue-600" />
                  <span className="mt-2 text-sm font-semibold text-slate-800">
                    Choose images to upload
                  </span>
                  <span className="mt-1 text-xs font-normal text-slate-500">
                    JPEG, PNG, WebP or GIF · Up to 6 images · 5 MB each
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleImageSelection}
                    className="sr-only"
                  />
                </span>
              </label>
              {productImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <p className="col-span-full text-xs text-slate-500">
                    Assign each image to a color, or leave it shared across all colors.
                  </p>
                  {productImages.map(({ file, preview }, index) => (
                    <div
                      key={preview}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="group relative aspect-square bg-slate-100">
                        <img
                          src={preview}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeProductImage(preview)}
                          aria-label={`Remove ${file.name}`}
                          className="absolute right-1.5 top-1.5 rounded-lg bg-slate-950/75 p-1.5 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <span className="absolute inset-x-0 bottom-0 truncate bg-slate-950/60 px-2 py-1 text-[10px] text-white">
                          {file.name}
                        </span>
                      </div>
                      <select
                        aria-label={`Assign ${file.name} to a color`}
                        value={productImageColors[index] || ""}
                        onChange={(event) =>
                          setProductImageColors((current) =>
                            current.map((color, imageIndex) =>
                              imageIndex === index ? event.target.value : color,
                            ),
                          )
                        }
                        className="w-full border-0 bg-white px-2 py-1.5 text-xs text-slate-700 focus:ring-2 focus:ring-inset focus:ring-blue-500"
                      >
                        <option value="">All colors</option>
                        {form.colors
                          .split(",")
                          .map((color) => color.trim())
                          .filter(Boolean)
                          .map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              {[
                ["sizes", "Available sizes", "S, M, L, XL"],
                ["colors", "Available colors", "Black, Blue"],
              ].map(([field, label, placeholder]) => (
                <label
                  key={field}
                  className="block text-sm font-medium text-slate-700"
                >
                  {label}
                  <input
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-400">
                    Optional, comma-separated
                  </span>
                </label>
              ))}
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea
                  required
                  rows="4"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              </label>
              <button
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                <ImagePlus className="h-4 w-4" />
                {saving ? "Publishing product..." : "Publish product"}
              </button>
            </div>
          </form>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Inventory
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Your products
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {products.length} {products.length === 1 ? "listing" : "listings"}
              </span>
            </div>
            {loading ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Loading your products...
              </p>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <Package className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">
                  Your catalog is ready
                </h3>
                <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                  Products you publish will appear here with stock and pricing
                  details.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {products.map((product) => (
                  <article
                    key={product._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-slate-400">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                      {!!product.images?.length && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-slate-950/75 px-2 py-1 text-[11px] font-semibold text-white">
                          <ImagePlus className="h-3 w-3" />
                          {product.images.length}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                        {product.brand || product.category}
                      </p>
                      <h3 className="mt-1 truncate font-semibold text-slate-900">
                        {product.title}
                      </h3>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">
                          {currency(product.price)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            product.stock > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {product.stock > 0
                            ? `${product.stock} in stock`
                            : "Out of stock"}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-xs text-slate-500">
                        {product.category}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>}

        {activeTab === "orders" && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Customer orders</h2>
              <p className="mt-1 text-sm text-slate-500">
                Orders containing products from your store.
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {ordersPagination.total} orders
            </span>
          </div>
          {ordersError && (
            <p role="alert" className="mb-4 text-sm text-red-700">{ordersError}</p>
          )}
          {ordersLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading orders...</p>
          ) : orders.length ? (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => {
                const sellerItems = order.items.filter(
                  (item) => String(item.seller) === String(user?._id),
                );
                return (
                  <article key={order._id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Order #{order._id.slice(-8).toUpperCase()}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.customer?.name || "Customer"} ·{" "}
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {currency(sellerItems.reduce(
                            (sum, item) => sum + item.price * item.quantity,
                            0,
                          ))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.orderStatus} · Payment {order.paymentInfo?.status}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                      {sellerItems.map((item) => (
                        <li key={item._id || `${item.product}-${item.title}`}>
                          {item.quantity} × {item.title}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No orders for your products yet.
            </p>
          )}
          <ListPagination
            page={ordersPagination.page}
            totalPages={ordersPagination.totalPages}
            total={ordersPagination.total}
            label="orders"
            onPageChange={(page) =>
              setOrdersPagination((current) => ({ ...current, page }))
            }
          />
        </section>}

        {activeTab === "profile" && <div className="mt-6 space-y-6">
          <ProfileSettings />
          <AccountSecurity />
        </div>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
