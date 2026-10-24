import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Store,
  Package,
  ShoppingBag,
  CreditCard,
  Layers,
  TicketPercent,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  Plus,
  Trash2,
  Eye,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Send,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Zap,
  FileText,
} from "lucide-react";
import api, { resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AccountSecurity from "../components/AccountSecurity";
import ProfileSettings from "../components/ProfileSettings";
import { hasCompleteColorImageAssignments } from "../utils/productImages";
import SpecialDealsModule from "../components/SpecialDealsModule";
import InfoPagesModule from "../components/InfoPagesModule";

const emptyBannerForm = {
  eyebrow: "",
  title: "",
  description: "",
  buttonLabel: "Shop Now",
  link: "/category",
  imageUrl: "",
  imageAlt: "",
  placement: "main",
  theme: "indigo",
  sortOrder: "0",
  isActive: true,
};

const getDealPrice = (originalPrice, discountPercentage) => {
  const price = Number(originalPrice);
  const discount = Number(discountPercentage);
  return price > 0 && discount > 0
    ? ((price * (100 - discount)) / 100).toFixed(2)
    : "";
};

const productCsvHeaders = [
  "title",
  "category",
  "brand",
  "originalPrice",
  "specialDiscountPercentage",
  "price",
  "stock",
  "sizes",
  "colors",
  "images",
  "colorImages",
  "description",
];

const requiredProductCsvHeaders = productCsvHeaders.filter(
  (header) => header !== "colorImages",
);

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        value += character;
      }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\r" && character !== "\n" && !/\s/.test(character)) {
      throw new Error("The CSV contains unexpected text after a quoted value.");
    }
    if (character === '"' && value.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === ",") {
      row.push(value.trim());
      value = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      row.push(value.trim());
      if (row.some((cell) => cell)) rows.push(row);
      row = [];
      value = "";
      closedQuote = false;
      if (character === "\r" && content[index + 1] === "\n") index += 1;
    } else if (!closedQuote) {
      value += character;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted value.");
  row.push(value.trim());
  if (row.some((cell) => cell)) rows.push(row);
  return rows;
};

const downloadProductCsvTemplate = () => {
  const csv = `${productCsvHeaders.join(",")}\r\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "shopmart-product-import-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AdminDashboard() {
  const { logout } = useAuth();
  const productRequestSequence = useRef(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSellers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    recentOrders: [],
    orderStatusCounts: {},
  });

  const [usersList, setUsersList] = useState([]);
  const [sellersList, setSellersList] = useState([]);
  const [viewingAccountId, setViewingAccountId] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountSort, setAccountSort] = useState("newest");
  const [accountLimit, setAccountLimit] = useState(10);
  const [accountPagination, setAccountPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [productsList, setProductsList] = useState([]);
  const [productPagination, setProductPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productMinPrice, setProductMinPrice] = useState("");
  const [productMaxPrice, setProductMaxPrice] = useState("");
  const [productSort, setProductSort] = useState("newest");
  const [productLimit, setProductLimit] = useState(10);
  const [viewingProduct, setViewingProduct] = useState(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({});
  const [retainedEditImages, setRetainedEditImages] = useState([]);
  const [newEditImages, setNewEditImages] = useState([]);
  const [editImagePreviews, setEditImagePreviews] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [showBulkProductForm, setShowBulkProductForm] = useState(false);
  const [bulkProductFile, setBulkProductFile] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [bulkImportError, setBulkImportError] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    title: "",
    category: "",
    brand: "",
    price: "",
    originalPrice: "",
    specialDiscountPercentage: "",
    stock: "",
    description: "",
    sizes: "",
    colors: "",
  });
  const [mainProductImage, setMainProductImage] = useState(null);
  const [relatedProductImages, setRelatedProductImages] = useState([]);
  const [newImageColors, setNewImageColors] = useState([]);
  const [retainedImageColors, setRetainedImageColors] = useState([]);
  const [newEditImageColors, setNewEditImageColors] = useState([]);
  const [imagePreviews, setImagePreviews] = useState({
    main: "",
    related: [],
  });
  const [ordersList, setOrdersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [couponsList, setCouponsList] = useState([]);
  const [bannersList, setBannersList] = useState([]);
  const [bannerForm, setBannerForm] = useState(emptyBannerForm);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [editingBannerId, setEditingBannerId] = useState("");
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerSearch, setBannerSearch] = useState("");
  const [newsletterSubscribers, setNewsletterSubscribers] = useState([]);
  const [newsletterSubscriberTotal, setNewsletterSubscriberTotal] = useState(0);
  const [newsletterSubscriberSearchInput, setNewsletterSubscriberSearchInput] =
    useState("");
  const [newsletterSubscriberSearch, setNewsletterSubscriberSearch] =
    useState("");
  const [newsletterPagination, setNewsletterPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [newsletterCampaigns, setNewsletterCampaigns] = useState([]);
  const [newsletterStatus, setNewsletterStatus] = useState(null);
  const [newsletterForm, setNewsletterForm] = useState({
    subject: "",
    message: "",
    bannerId: "",
  });
  const [sendingNewsletter, setSendingNewsletter] = useState(false);

  // Form inputs
  const [newCatName, setNewCatName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount: "",
    minSpend: "",
    startDate: "",
    expiryDate: "",
  });

  useEffect(() => {
    const mainPreview = mainProductImage
      ? URL.createObjectURL(mainProductImage)
      : "";
    const relatedPreviews = relatedProductImages.map((file) =>
      URL.createObjectURL(file),
    );
    setImagePreviews({ main: mainPreview, related: relatedPreviews });

    return () => {
      if (mainPreview) URL.revokeObjectURL(mainPreview);
      relatedPreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [mainProductImage, relatedProductImages]);

  useEffect(() => {
    const previews = newEditImages.map((file) => URL.createObjectURL(file));
    setEditImagePreviews(previews);
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [newEditImages]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const { data } = await api.get("/admin/categories");
      if (!Array.isArray(data)) {
        throw new Error("The categories response was invalid.");
      }
      setCategoriesList(data);
    } catch (requestError) {
      setCategoriesError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load categories.",
      );
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadTabData = useCallback(async (tab) => {
    let productRequestId;
    if (tab !== "products") productRequestSequence.current += 1;
    setLoading(true);
    setErrorMessage("");
    try {
      if (tab === "dashboard") {
        const res = await api.get("/admin/stats");
        if (res.data?.metrics) {
          setStats({
            ...res.data.metrics,
            orderStatusCounts: res.data.orderStatusCounts || {},
            recentOrders: (res.data.recentOrders || []).map((order) => ({
              id: `#${order._id.slice(-8)}`,
              customer: order.customer?.name || "Customer",
              date: new Date(order.createdAt).toLocaleDateString(),
              amount: `₹${order.totalAmount.toLocaleString("en-IN")}`,
              status: order.orderStatus,
            })),
          });
        }
      } else if (tab === "users") {
        const res = await api.get("/admin/users", {
          params: {
            page: accountPagination.page,
            limit: accountLimit,
            search: accountSearch,
            sort: accountSort,
          },
        });
        setUsersList(res.data.users);
        setAccountPagination(res.data.pagination);
      } else if (tab === "sellers") {
        const res = await api.get("/admin/sellers", {
          params: {
            page: accountPagination.page,
            limit: accountLimit,
            search: accountSearch,
            sort: accountSort,
          },
        });
        setSellersList(res.data.users);
        setAccountPagination(res.data.pagination);
      } else if (tab === "products") {
        productRequestId = ++productRequestSequence.current;
        const [productsResult] = await Promise.allSettled([
          api.get("/admin/products", {
            params: {
              page: productPagination.page,
              limit: productLimit,
              search: productSearch,
              category: productCategory,
              stock: productStock,
              minPrice: productMinPrice,
              maxPrice: productMaxPrice,
              sort: productSort,
            },
          }),
          loadCategories(),
        ]);
        if (productRequestId !== productRequestSequence.current) return;
        if (productsResult.status === "fulfilled") {
          const response = productsResult.value.data;
          if (!Array.isArray(response?.products) || !response.pagination) {
            throw new Error("The products response was invalid.");
          }
          setProductsList(response.products);
          setProductPagination(response.pagination);
        } else {
          throw productsResult.reason;
        }
      } else if (tab === "orders") {
        const res = await api.get("/admin/orders");
        setOrdersList(res.data);
      } else if (tab === "categories") {
        const res = await api.get("/admin/categories");
        setCategoriesList(res.data);
      } else if (tab === "coupons") {
        const res = await api.get("/admin/coupons");
        setCouponsList(res.data);
      } else if (tab === "special-deals") {
        return;
      } else if (tab === "info-pages") {
        return;
      } else if (tab === "banners") {
        const res = await api.get("/admin/banners");
        if (!Array.isArray(res.data)) {
          throw new Error("The banners response was invalid.");
        }
        setBannersList(res.data);
      } else if (tab === "newsletter") {
        const [subscribersResponse, campaignsResponse, statusResponse, bannersResponse] =
          await Promise.all([
            api.get("/admin/newsletter/subscribers", {
              params: {
                page: newsletterPagination.page,
                limit: newsletterPagination.limit,
                search: newsletterSubscriberSearch,
              },
            }),
            api.get("/admin/newsletter/campaigns"),
            api.get("/admin/newsletter/status"),
            api.get("/admin/banners"),
          ]);
        setNewsletterSubscribers(subscribersResponse.data.subscribers || []);
        setNewsletterPagination(subscribersResponse.data.pagination);
        setNewsletterSubscriberTotal(
          subscribersResponse.data.subscribedTotal || 0,
        );
        setNewsletterCampaigns(campaignsResponse.data || []);
        setNewsletterStatus(statusResponse.data);
        setBannersList(bannersResponse.data || []);
      }
    } catch (requestError) {
      if (
        tab !== "products" ||
        productRequestId === productRequestSequence.current
      ) {
        setErrorMessage(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load this section from the server.",
        );
      }
    } finally {
      if (
        tab !== "products" ||
        productRequestId === productRequestSequence.current
      ) {
        setLoading(false);
      }
    }
  }, [
    productPagination.page,
    productLimit,
    productSearch,
    productCategory,
    productStock,
    productMinPrice,
    productMaxPrice,
    productSort,
    accountPagination.page,
    accountLimit,
    accountSearch,
    accountSort,
    newsletterPagination.page,
    newsletterPagination.limit,
    newsletterSubscriberSearch,
  ]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const newsletterHasPendingCampaign = newsletterCampaigns.some((campaign) =>
    ["queued", "sending"].includes(campaign.status),
  );
  useEffect(() => {
    if (activeTab !== "newsletter" || !newsletterHasPendingCampaign) {
      return undefined;
    }
    let active = true;
    const refreshCampaigns = async () => {
      try {
        const { data } = await api.get("/admin/newsletter/campaigns");
        if (active) setNewsletterCampaigns(data);
      } catch (requestError) {
        if (active) {
          setErrorMessage(
            requestError.response?.data?.message ||
              "Unable to refresh newsletter delivery status.",
          );
        }
      }
    };
    const interval = window.setInterval(refreshCampaigns, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeTab, newsletterHasPendingCampaign]);

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      loadTabData("orders");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to update order status.",
      );
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to remove this product?"))
      return;
    try {
      await api.delete(`/admin/products/${id}`);
      if (productsList.length === 1 && productPagination.page > 1) {
        setProductPagination((current) => ({ ...current, page: current.page - 1 }));
      } else {
        loadTabData("products");
      }
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to delete product.",
      );
    }
  };

  const handleEditProduct = (product) => {
    setErrorMessage("");
    setEditError("");
    setEditingProduct(product);
    setEditProductForm({
      title: product.title || "",
      category: product.category || "",
      brand: product.brand || "",
      price: product.price ?? "",
      originalPrice: product.originalPrice ?? "",
      specialDiscountPercentage: product.specialDiscountPercentage ?? "",
      stock: product.stock ?? "",
      description: product.description || "",
      sizes: (product.sizes || []).join(", "),
      colors: (product.colors || []).join(", "),
    });
    setRetainedEditImages(product.images || []);
    setRetainedImageColors(
      (product.images || []).map(
        (image) =>
          product.colorImages?.find((group) => group.images.includes(image))
            ?.color || "",
      ),
    );
    setNewEditImages([]);
    setNewEditImageColors([]);
    if (categoriesList.length === 0) loadCategories();
  };

  const handleSaveProductEdit = async (event) => {
    event.preventDefault();
    if (!editingProduct) return;
    const specialDiscountPercentage = Number(
      editProductForm.specialDiscountPercentage || 0,
    );
    const price = Number(
      specialDiscountPercentage > 0
        ? getDealPrice(
            editProductForm.originalPrice,
            specialDiscountPercentage,
          )
        : editProductForm.price,
    );
    const originalPrice = Number(editProductForm.originalPrice);
    if (specialDiscountPercentage > 99 || specialDiscountPercentage < 0) {
      setEditError("Special deal discount must be between 0% and 99%.");
      return;
    }
    if (originalPrice < price) {
      setEditError(
        "Original price must be equal to or greater than the selling price.",
      );
      return;
    }
    if (retainedEditImages.length + newEditImages.length === 0) {
      setEditError("A product must have at least one image.");
      return;
    }
    if (retainedEditImages.length + newEditImages.length > 6) {
      setEditError("A product can have up to 6 images.");
      return;
    }
    const editColors = editProductForm.colors
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);
    if (
      [...retainedImageColors, ...newEditImageColors].some(
        (color) => color && !editColors.includes(color),
      )
    ) {
      setEditError("Each color-assigned image must match an available product color.");
      return;
    }
    if (
      !hasCompleteColorImageAssignments(editColors, [
        ...retainedImageColors,
        ...newEditImageColors,
      ])
    ) {
      setEditError("Assign at least one image to every product color, or leave an image shared across all colors.");
      return;
    }

    const payload = new FormData();
    Object.entries({
      ...editProductForm,
      title: editProductForm.title.trim(),
      category: editProductForm.category.trim(),
      brand: editProductForm.brand.trim(),
      price: String(price),
      originalPrice: String(originalPrice),
      specialDiscountPercentage: String(specialDiscountPercentage),
      stock: String(Number(editProductForm.stock)),
      description: editProductForm.description.trim(),
      sizes: JSON.stringify(
        editProductForm.sizes.split(",").map((value) => value.trim()).filter(Boolean),
      ),
      colors: JSON.stringify(
        editProductForm.colors.split(",").map((value) => value.trim()).filter(Boolean),
      ),
    }).forEach(([field, value]) => payload.append(field, String(value)));
    payload.append("retainedImages", JSON.stringify(retainedEditImages));
    payload.append(
      "colorImageSelections",
      JSON.stringify(
        [...retainedImageColors, ...newEditImageColors]
          .map((color, imageIndex) => ({ color, imageIndex }))
          .filter((selection) => selection.color),
      ),
    );
    newEditImages.forEach((file) => payload.append("images", file));

    setSavingEdit(true);
    setEditError("");
    try {
      const { data } = await api.put(
        `/admin/products/${editingProduct._id}`,
        payload,
      );
      setProductsList((current) =>
        current.map((product) =>
          product._id === data._id ? data : product,
        ),
      );
      if (viewingProduct?._id === data._id) {
        setViewingProduct(data);
        setViewImageIndex(0);
      }
      setEditingProduct(null);
      loadTabData("products");
    } catch (requestError) {
      setEditError(
        requestError.response?.data?.message || "Unable to update product.",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    const specialDiscountPercentage = Number(
      newProduct.specialDiscountPercentage || 0,
    );
    const price = Number(
      specialDiscountPercentage > 0
        ? getDealPrice(newProduct.originalPrice, specialDiscountPercentage)
        : newProduct.price,
    );
    const originalPrice = Number(newProduct.originalPrice);
    if (specialDiscountPercentage > 99 || specialDiscountPercentage < 0) {
      setErrorMessage("Special deal discount must be between 0% and 99%.");
      return;
    }
    if (originalPrice < price) {
      setErrorMessage(
        "Original price must be equal to or greater than the selling price.",
      );
      return;
    }
    if (!mainProductImage) {
      setErrorMessage("Choose a main product image before saving.");
      return;
    }
    const productColors = newProduct.colors
      .split(",")
      .map((color) => color.trim())
      .filter(Boolean);
    if (
      newImageColors.some(
        (color) => color && !productColors.includes(color),
      )
    ) {
      setErrorMessage("Each color-assigned image must match an available product color.");
      return;
    }
    if (!hasCompleteColorImageAssignments(productColors, newImageColors)) {
      setErrorMessage("Assign at least one image to every product color, or leave an image shared across all colors.");
      return;
    }
    setSavingProduct(true);
    setErrorMessage("");
    const payload = new FormData();
    payload.append("title", newProduct.title.trim());
    payload.append("category", newProduct.category.trim());
    payload.append("brand", newProduct.brand.trim());
    payload.append("price", String(price));
    payload.append("originalPrice", String(originalPrice));
    payload.append(
      "specialDiscountPercentage",
      String(specialDiscountPercentage),
    );
    payload.append("stock", String(Number(newProduct.stock)));
    payload.append("description", newProduct.description.trim());
    payload.append(
      "sizes",
      JSON.stringify(newProduct.sizes.split(",").map((value) => value.trim()).filter(Boolean)),
    );
    payload.append(
      "colors",
      JSON.stringify(newProduct.colors.split(",").map((value) => value.trim()).filter(Boolean)),
    );
    payload.append("images", mainProductImage);
    relatedProductImages.forEach((file) => payload.append("images", file));
    payload.append(
      "colorImageSelections",
      JSON.stringify(
        newImageColors
          .map((color, imageIndex) => ({ color, imageIndex }))
          .filter((selection) => selection.color),
      ),
    );

    try {
      await api.post("/products", payload);
      setNewProduct({
        title: "",
        category: "",
        brand: "",
        price: "",
        originalPrice: "",
        specialDiscountPercentage: "",
        stock: "",
        description: "",
        sizes: "",
        colors: "",
      });
      setMainProductImage(null);
      setRelatedProductImages([]);
      setNewImageColors([]);
      setShowProductForm(false);
      setProductSearch("");
      setProductCategory("");
      setProductStock("");
      setProductMinPrice("");
      setProductMaxPrice("");
      setProductSort("newest");
      setProductPagination((current) =>
        current.page === 1
          ? { ...current, limit: productLimit }
          : { ...current, page: 1, limit: productLimit },
      );
      if (
        productPagination.page === 1 &&
        !productSearch &&
        !productCategory &&
        !productStock &&
        !productMinPrice &&
        !productMaxPrice &&
        productSort === "newest"
      ) {
        loadTabData("products");
      }
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to add product.",
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleBulkProductImport = async (event) => {
    event.preventDefault();
    setBulkImportError("");
    setBulkImportResult(null);
    if (!bulkProductFile) {
      setBulkImportError("Choose a CSV file to import.");
      return;
    }

    let products;
    try {
      if (bulkProductFile.size > 1_000_000) {
        throw new Error("The CSV file must be smaller than 1 MB.");
      }
      const rows = parseCsv(await bulkProductFile.text());
      const headers = rows[0].map((header, index) =>
        (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim(),
      );
      if (new Set(headers).size !== headers.length) {
        throw new Error("The CSV contains duplicate column names.");
      }
      const missingHeaders = productCsvHeaders.filter(
        (header) =>
          requiredProductCsvHeaders.includes(header) && !headers.includes(header),
      );
      if (missingHeaders.length) {
        throw new Error(`Missing CSV columns: ${missingHeaders.join(", ")}.`);
      }
      if (rows.length < 2) throw new Error("The CSV has no product rows.");
      if (rows.length - 1 > 100) {
        throw new Error("Import up to 100 products at a time.");
      }

      products = rows.slice(1).map((row, index) => {
        if (row.length !== headers.length) {
          throw new Error(`CSV row ${index + 2} has a different number of columns than the header.`);
        }
        const record = Object.fromEntries(
          headers.map((header, headerIndex) => [
            header,
            row[headerIndex] || "",
          ]),
        );
        const discount = Number(record.specialDiscountPercentage || 0);
        const originalPrice = Number(record.originalPrice);
        const price =
          discount > 0
            ? Number(getDealPrice(originalPrice, discount))
            : Number(record.price);
        return {
          title: record.title,
          category: record.category,
          brand: record.brand,
          originalPrice,
          specialDiscountPercentage: discount,
          price,
          stock: Number(record.stock),
          sizes: record.sizes
            .split(",")
            .map((size) => size.trim())
            .filter(Boolean),
          colors: record.colors
            .split(",")
            .map((color) => color.trim())
            .filter(Boolean),
          images: record.images
            .split("|")
            .map((image) => image.trim())
            .filter(Boolean),
          colorImageSelections: (() => {
            if (!(record.colorImages || "").trim()) return [];
            let colorImages;
            try {
              colorImages = JSON.parse(record.colorImages);
            } catch {
              throw new Error(`CSV row ${index + 2} has invalid colorImages JSON.`);
            }
            if (
              !colorImages ||
              typeof colorImages !== "object" ||
              Array.isArray(colorImages)
            ) {
              throw new Error(`CSV row ${index + 2} colorImages must be a JSON object.`);
            }
            return Object.entries(colorImages).flatMap(([color, imageUrls]) => {
              if (!Array.isArray(imageUrls)) {
                throw new Error(`CSV row ${index + 2} colorImages must map colors to image URL arrays.`);
              }
              return imageUrls.map((imageUrl) => {
                const normalizedImageUrl =
                  typeof imageUrl === "string" ? imageUrl.trim() : "";
                const imageIndex = record.images
                  .split("|")
                  .map((image) => image.trim())
                  .filter(Boolean)
                  .indexOf(normalizedImageUrl);
                if (imageIndex < 0) {
                  throw new Error(`CSV row ${index + 2} color image URLs must also appear in the images column.`);
                }
                return { color, imageIndex };
              });
            });
          })(),
          description: record.description,
          rowNumber: index + 2,
        };
      });
    } catch (parseError) {
      setBulkImportError(parseError.message || "Unable to read the CSV file.");
      return;
    }

    setBulkImporting(true);
    try {
      const { data } = await api.post("/admin/products/bulk", { products });
      setBulkImportResult(data);
      if (data.createdCount > 0) loadTabData("products");
    } catch (requestError) {
      setBulkImportError(
        requestError.response?.data?.message || "Unable to import products.",
      );
    } finally {
      setBulkImporting(false);
    }
  };

  const handleDeleteUser = async (id, role) => {
    if (!window.confirm(`Remove this ${role} account?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      if (role === "seller") {
        if (sellersList.length === 1 && accountPagination.page > 1) {
          setAccountPagination((current) => ({ ...current, page: current.page - 1 }));
        } else {
          loadTabData("sellers");
        }
      } else {
        if (usersList.length === 1 && accountPagination.page > 1) {
          setAccountPagination((current) => ({ ...current, page: current.page - 1 }));
        } else {
          loadTabData("users");
        }
      }
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to remove account.",
      );
    }
  };

  const handleUpdateAccountStatus = async (account) => {
    const isActive = !account.isActive;
    try {
      await api.put(`/admin/users/${account._id}/status`, { isActive });
      await loadTabData(activeTab);
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message ||
          "Unable to update account status.",
      );
    }
  };

  const handleApproveSeller = async (sellerId) => {
    try {
      await api.put(`/admin/sellers/${sellerId}/approve`);
      await loadTabData("sellers");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to approve seller.",
      );
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api.delete(`/admin/categories/${id}`);
      const deletedCategory = categoriesList.find(
        (category) => category._id === id,
      );
      setCategoriesList((current) =>
        current.filter((category) => category._id !== id),
      );
      if (newProduct.category === deletedCategory?.name) {
        setNewProduct((current) => ({ ...current, category: "" }));
      }
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to remove category.",
      );
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await api.post("/admin/categories", { name: newCatName });
      setCategoriesList((current) => [...current, res.data]);
      setNewCatName("");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to create category.",
      );
    }
  };

  const handleEditCategory = (category) => {
    setErrorMessage("");
    setEditingCategoryId(category._id);
    setEditingCategoryName(category.name);
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    const existingCategory = categoriesList.find(
      (category) => category._id === editingCategoryId,
    );
    setSavingCategory(true);
    setErrorMessage("");
    try {
      const { data } = await api.put(
        `/admin/categories/${editingCategoryId}`,
        { name: editingCategoryName.trim() },
      );
      setCategoriesList((current) =>
        current.map((category) =>
          category._id === data._id ? data : category,
        ),
      );
      if (existingCategory) {
        const oldName = existingCategory.name;
        setProductsList((current) =>
          current.map((product) =>
            product.category === oldName
              ? { ...product, category: data.name }
              : product,
          ),
        );
        setNewProduct((current) =>
          current.category === oldName
            ? { ...current, category: data.name }
            : current,
        );
        setEditProductForm((current) =>
          current.category === oldName
            ? { ...current, category: data.name }
            : current,
        );
        setProductCategory((current) => (current === oldName ? data.name : current));
      }
      setEditingCategoryId("");
      setEditingCategoryName("");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to update category.",
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.startDate || !newCoupon.expiryDate) {
      setErrorMessage("Enter a coupon code and its start and end dates.");
      return;
    }
    if (newCoupon.expiryDate < newCoupon.startDate) {
      setErrorMessage("Coupon end date must be on or after its start date.");
      return;
    }
    const payload = {
      code: newCoupon.code.toUpperCase(),
      discountPercentage: Number(newCoupon.discount),
      minOrderAmount: Number(newCoupon.minSpend),
      startDate: newCoupon.startDate,
      expiryDate: newCoupon.expiryDate,
    };
    try {
      const res = await api.post("/admin/coupons", payload);
      setCouponsList([...couponsList, res.data]);
      setNewCoupon({
        code: "",
        discount: "",
        minSpend: "",
        startDate: "",
        expiryDate: "",
      });
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to create coupon.",
      );
    }
  };

  const handleSaveBanner = async (event) => {
    event.preventDefault();
    if (!bannerImageFile && !bannerForm.imageUrl.trim()) {
      setErrorMessage("Upload a banner image or enter an HTTPS image URL.");
      return;
    }
    setSavingBanner(true);
    setErrorMessage("");
    try {
      const payload = new FormData();
      Object.entries({
        ...bannerForm,
        sortOrder: Number(bannerForm.sortOrder),
      }).forEach(([key, value]) => payload.append(key, String(value)));
      if (bannerImageFile) payload.append("image", bannerImageFile);
      const { data } = editingBannerId
        ? await api.put(`/admin/banners/${editingBannerId}`, payload)
        : await api.post("/admin/banners", payload);
      setBannersList((current) => {
        const updated = editingBannerId
          ? current.map((banner) => (banner._id === data._id ? data : banner))
          : [...current, data];
        return updated.sort(
          (a, b) =>
            a.placement.localeCompare(b.placement) ||
            a.sortOrder - b.sortOrder ||
            a.createdAt.localeCompare(b.createdAt),
        );
      });
      setBannerForm(emptyBannerForm);
      setBannerImageFile(null);
      setEditingBannerId("");
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to save banner.",
      );
    } finally {
      setSavingBanner(false);
    }
  };

  const handleEditBanner = (banner) => {
    setErrorMessage("");
    setBannerForm({
      eyebrow: banner.eyebrow,
      title: banner.title,
      description: banner.description,
      buttonLabel: banner.buttonLabel,
      link: banner.link,
      imageUrl: banner.imageUrl,
      imageAlt: banner.imageAlt,
      placement: banner.placement,
      theme: banner.theme,
      sortOrder: String(banner.sortOrder),
      isActive: banner.isActive,
    });
    setBannerImageFile(null);
    setEditingBannerId(banner._id);
  };

  const handleDeleteBanner = async (banner) => {
    if (!window.confirm(`Delete the "${banner.title}" banner?`)) return;
    setErrorMessage("");
    try {
      await api.delete(`/admin/banners/${banner._id}`);
      setBannersList((current) =>
        current.filter((item) => item._id !== banner._id),
      );
      if (editingBannerId === banner._id) {
        setBannerForm(emptyBannerForm);
        setBannerImageFile(null);
        setEditingBannerId("");
      }
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to delete banner.",
      );
    }
  };

  const filteredBanners = bannersList.filter((banner) => {
    const search = bannerSearch.trim().toLowerCase();
    return (
      !search ||
      [banner.title, banner.eyebrow, banner.placement, banner.link]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search))
    );
  });

  const navLinks = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "sellers", label: "Sellers", icon: Store },
    { id: "products", label: "Products", icon: Package },
    { id: "orders", label: "Orders", icon: ShoppingBag },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "categories", label: "Categories", icon: Layers },
    { id: "coupons", label: "Coupons", icon: TicketPercent },
    { id: "special-deals", label: "Special Deals", icon: Zap },
    { id: "info-pages", label: "Content Pages", icon: FileText },
    { id: "banners", label: "Homepage Banners", icon: Megaphone },
    { id: "newsletter", label: "Newsletter", icon: Mail },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleToggleCoupon = async (coupon) => {
    try {
      const { data } = await api.put(`/admin/coupons/${coupon._id}/toggle`);
      setCouponsList((current) =>
        current.map((item) => (item._id === coupon._id ? data.coupon : item)),
      );
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message || "Unable to update coupon.",
      );
    }
  };

  const handleCreateNewsletterCampaign = async (event) => {
    event.preventDefault();
    const selectedBanner = bannersList.find(
      (banner) => banner._id === newsletterForm.bannerId,
    );
    const bannerLabel = selectedBanner
      ? ` featuring "${selectedBanner.title}"`
      : "";
    const confirmed = window.confirm(
      `Send this campaign${bannerLabel} to all ${newsletterSubscriberTotal} subscribed email addresses? Each subscriber receives a separate email.`,
    );
    if (!confirmed) return;

    setSendingNewsletter(true);
    setErrorMessage("");
    try {
      const { data } = await api.post(
        "/admin/newsletter/campaigns",
        newsletterForm,
      );
      setNewsletterCampaigns((current) => [data.campaign, ...current].slice(0, 20));
      setNewsletterForm({ subject: "", message: "", bannerId: "" });
    } catch (requestError) {
      setErrorMessage(
        requestError.response?.data?.message ||
          "Unable to queue the newsletter campaign.",
      );
    } finally {
      setSendingNewsletter(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-[#2563EB] tracking-tight">
              SHOPMART
            </span>
            <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded">
              Admin
            </span>
          </div>

          <span className="text-xs text-gray-500">Administrator</span>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1 flex gap-6">
        {/* Left Sidebar Navigation */}
        <aside className="w-56 flex-shrink-0 bg-white border border-gray-200 rounded-2xl p-3 h-fit shadow-sm space-y-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "users" || item.id === "sellers") {
                    setAccountPagination((current) => ({
                      ...current,
                      page: 1,
                    }));
                  }
                  if (item.id === "newsletter") {
                    setNewsletterPagination((current) => ({
                      ...current,
                      page: 1,
                    }));
                  }
                  setActiveTab(item.id);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/20"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}

          <div className="pt-4 mt-2 border-t border-gray-100">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Dynamic Main Workspace Content */}
        <main className="flex-1 min-w-0">
          {errorMessage && (
            <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {loading ? (
            <div className="h-64 flex items-center justify-center bg-white border border-gray-200 rounded-2xl text-xs text-gray-500">
              Loading module data...
            </div>
          ) : activeTab === "dashboard" ? (
            <div className="space-y-6">
              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">
                    Total Users
                  </p>
                  <div className="flex items-baseline justify-between mt-2">
                    <h3 className="text-2xl font-black text-gray-900">
                      {stats.totalUsers}
                    </h3>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Live
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">
                    Total Sellers
                  </p>
                  <div className="flex items-baseline justify-between mt-2">
                    <h3 className="text-2xl font-black text-gray-900">
                      {stats.totalSellers}
                    </h3>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Live
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">
                    Total Orders
                  </p>
                  <div className="flex items-baseline justify-between mt-2">
                    <h3 className="text-2xl font-black text-gray-900">
                      {stats.totalOrders}
                    </h3>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Live
                    </span>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <p className="text-xs font-medium text-gray-500">
                    Total Revenue
                  </p>
                  <div className="flex items-baseline justify-between mt-2">
                    <h3 className="text-2xl font-black text-gray-900">
                      ₹{stats.totalRevenue.toLocaleString("en-IN")}
                    </h3>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      Paid orders
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Section: Sales Chart & Order Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sales Overview Vector Graph */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-gray-800">
                      Order fulfillment status
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                    {[
                      ["Delivered", "#2563EB"],
                      ["Shipped", "#22C55E"],
                      ["Processing", "#EAB308"],
                      ["Cancelled", "#EF4444"],
                    ].map(([label, color]) => (
                      <div key={label} className="border rounded-xl p-4">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-xl font-bold mt-2">
                          {stats.orderStatusCounts[label] || 0}
                        </p>
                        <span
                          className="block h-1 rounded mt-3"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Statistics Chart / Breakdown */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <h4 className="text-sm font-bold text-gray-800 mb-2">
                    Order Statistics
                  </h4>
                  <div className="flex items-center justify-center py-2">
                    <div className="relative w-36 h-36">
                      <svg
                        viewBox="0 0 36 36"
                        className="w-full h-full transform -rotate-90"
                      >
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#E2E8F0"
                          strokeWidth="4"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                        {stats.totalOrders}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-center text-gray-500">
                    Orders recorded in the store
                  </p>
                </div>
              </div>

              {/* Bottom Section: Recent Orders & Top Sellers */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Orders Table */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-gray-800">
                      Recent Orders
                    </h4>
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-gray-400 font-semibold border-b border-gray-100">
                          <th className="pb-3">Order ID</th>
                          <th className="pb-3">Customer</th>
                          <th className="pb-3">Date</th>
                          <th className="pb-3">Amount</th>
                          <th className="pb-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 font-medium">
                        {stats.recentOrders.map((ord, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="py-3 font-bold text-gray-800">
                              {ord.id}
                            </td>
                            <td className="text-gray-700">{ord.customer}</td>
                            <td className="text-gray-500">{ord.date}</td>
                            <td className="font-bold text-gray-900">
                              {ord.amount}
                            </td>
                            <td>
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  ord.status === "Delivered"
                                    ? "bg-green-50 text-green-700"
                                    : ord.status === "Shipped"
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-orange-50 text-orange-700"
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-gray-800">
                    Seller accounts
                  </h4>
                  <p className="text-xs text-gray-500 mt-2">
                    Manage seller registrations and product listings from the seller sections.
                  </p>
                  <button
                    onClick={() => setActiveTab("sellers")}
                    className="mt-4 text-xs text-blue-600 font-semibold hover:underline"
                  >
                    View seller accounts
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "products" ? (
            /* Products Module */
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-gray-800">
                  Inventory & Products
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setBulkImportError("");
                      setBulkImportResult(null);
                      setShowBulkProductForm((open) => !open);
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {showBulkProductForm ? "Close import" : "Bulk import"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setShowBulkProductForm(false);
                      const openingForm = !showProductForm;
                      setShowProductForm(openingForm);
                      if (openingForm) loadCategories();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    {showProductForm ? "Cancel" : "Add Product"}
                  </button>
                </div>
              </div>
              {showBulkProductForm && (
                <form
                  onSubmit={handleBulkProductImport}
                  className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800">
                        Import products from CSV
                      </h4>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-600">
                        Include the same product details as the add form. Use
                        comma-separated sizes/colors and separate image URLs
                        with a pipe (|). Each product needs 1–6 absolute
                          http(s) image URLs. Optional colorImages is a JSON
                          object mapping colors to their image URL arrays, such
                          as {"{\"Purple\":[\"https://example.com/purple.jpg\"]}"}.
                          Imports are limited to 100 products
                        per file; valid rows are saved even if another row has
                        an error.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadProductCsvTemplate}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Download CSV template
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="min-w-[220px] flex-1 text-xs font-medium text-gray-700">
                      Product CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        required
                        onChange={(event) => {
                          setBulkProductFile(event.target.files?.[0] || null);
                          setBulkImportError("");
                          setBulkImportResult(null);
                        }}
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:font-semibold file:text-blue-700"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={bulkImporting || !bulkProductFile}
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {bulkImporting ? "Importing..." : "Import products"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Required columns: {requiredProductCsvHeaders.join(", ")}.
                    colorImages is optional. Discount, sizes, and colors may
                    be left blank where not applicable.
                  </p>
                  {bulkImportError && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                      {bulkImportError}
                    </p>
                  )}
                  {bulkImportResult && (
                    <div
                      role="status"
                      className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm"
                    >
                      <p className="font-semibold text-gray-800">
                        Imported {bulkImportResult.createdCount} of{" "}
                        {bulkImportResult.totalCount} products.
                      </p>
                      {bulkImportResult.errors?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-red-700">
                          {bulkImportResult.errors.map((item) => (
                            <li key={`${item.row}-${item.message}`}>
                              Row {item.row}: {item.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </form>
              )}
              {showProductForm && (
                <form
                  onSubmit={handleAddProduct}
                  className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-gray-50 p-4"
                >
                  <h4 className="sm:col-span-2 text-sm font-bold text-gray-800">
                    New product details
                  </h4>
                  {[
                    ["title", "Product name"],
                    ["brand", "Brand"],
                    ["originalPrice", "Original price (₹)"],
                    ["specialDiscountPercentage", "Special deal discount (%)"],
                    ["price", "Selling price (₹)"],
                    ["stock", "Stock quantity"],
                  ].map(([field, label]) => (
                    <label key={field} className="text-xs font-medium text-gray-600">
                      {label}
                      <input
                        required={!["specialDiscountPercentage"].includes(field)}
                        type={["price", "originalPrice", "stock", "specialDiscountPercentage"].includes(field) ? "number" : "text"}
                        min={
                          field === "originalPrice"
                            ? "0.01"
                            : field === "price"
                              ? "0.01"
                              : field === "specialDiscountPercentage"
                                ? "0"
                              : field === "stock"
                                ? "0"
                                : undefined
                        }
                        max={field === "specialDiscountPercentage" ? "99" : undefined}
                        step={["price", "originalPrice"].includes(field) ? "0.01" : field === "specialDiscountPercentage" ? "1" : undefined}
                        value={newProduct[field]}
                        disabled={
                          field === "price" &&
                          Number(newProduct.specialDiscountPercentage) > 0
                        }
                        onChange={(event) =>
                          setNewProduct((current) => {
                            const updated = {
                              ...current,
                              [field]: event.target.value,
                            };
                            if (
                              ["originalPrice", "specialDiscountPercentage"].includes(field) &&
                              Number(updated.specialDiscountPercentage) > 0
                            ) {
                              updated.price = getDealPrice(
                                updated.originalPrice,
                                updated.specialDiscountPercentage,
                              );
                            } else if (
                              field === "specialDiscountPercentage" &&
                              Number(current.specialDiscountPercentage) > 0
                            ) {
                              updated.price = updated.originalPrice;
                            }
                            return updated;
                          })
                        }
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-slate-100"
                      />
                      {field === "specialDiscountPercentage" && (
                        <span className="mt-1 block font-normal text-slate-500">
                          Set a product-specific deal. The price is calculated from the original price.
                        </span>
                      )}
                    </label>
                  ))}
                  {[
                    ["sizes", "Available sizes (comma-separated)"],
                    ["colors", "Available colors (comma-separated)"],
                  ].map(([field, label]) => (
                    <label key={field} className="text-xs font-medium text-gray-600">
                      {label}
                      <input
                        value={newProduct[field]}
                        onChange={(event) =>
                          setNewProduct((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                        placeholder={field === "sizes" ? "S, M, L, XL" : "Black, Blue"}
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                      />
                    </label>
                  ))}
                  <label className="text-xs font-medium text-gray-600">
                    Category
                    <select
                      required
                      value={newProduct.category}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          category: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="">
                        {categoriesLoading
                          ? "Loading categories..."
                          : categoriesList.length
                            ? "Select a category"
                            : "No categories available"}
                      </option>
                      {categoriesList
                        .filter((category) => category.isActive !== false)
                        .map((category) => (
                          <option key={category._id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                    {categoriesError && (
                      <span role="alert" className="mt-1 block font-normal text-red-600">
                        {categoriesError}
                      </span>
                    )}
                    {categoriesList.length === 0 && !categoriesLoading && (
                      <span className="mt-1 block font-normal text-gray-500">
                        Add a category in the Categories module first.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={loadCategories}
                      disabled={categoriesLoading}
                      className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {categoriesLoading ? "Refreshing..." : "Refresh categories"}
                    </button>
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Main product image
                    <input
                      required
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => {
                        setMainProductImage(event.target.files?.[0] || null);
                        setNewImageColors((current) => [
                          current[0] || "",
                          ...current.slice(1),
                        ]);
                      }}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-blue-700"
                    />
                    <span className="mt-1 block text-[11px] font-normal text-gray-500">
                      Required · JPEG, PNG, WebP, or GIF · up to 5 MB
                    </span>
                  </label>
                  <label className="text-xs font-medium text-gray-600">
                    Related images
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      onChange={(event) => {
                        const files = Array.from(event.target.files || []);
                        if (files.length > 5) {
                          setErrorMessage("You can add up to 5 related images.");
                          event.target.value = "";
                          return;
                        }
                        setErrorMessage("");
                        setRelatedProductImages(files);
                        setNewImageColors((current) => [
                          current[0] || "",
                          ...files.map((_, index) => current[index + 1] || ""),
                        ]);
                      }}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-blue-700"
                    />
                    <span className="mt-1 block text-[11px] font-normal text-gray-500">
                      Optional · choose up to 5 images
                    </span>
                  </label>
                  {(imagePreviews.main || imagePreviews.related.length > 0) && (
                    <div className="sm:col-span-2 flex flex-wrap gap-3">
                      <p className="w-full text-[11px] text-gray-500">
                        Assign each image to a color, or leave it as a shared image for all colors.
                      </p>
                      {imagePreviews.main && (
                        <div className="relative">
                          <img
                            src={imagePreviews.main}
                            alt="Main product preview"
                            className="h-24 w-24 rounded-lg border object-cover"
                          />
                          <span className="mt-1 block text-[10px] font-semibold text-gray-600">
                            Main image
                          </span>
                          <select
                            aria-label="Assign main image to a color"
                            value={newImageColors[0] || ""}
                            onChange={(event) =>
                              setNewImageColors((current) => {
                                const next = [...current];
                                next[0] = event.target.value;
                                return next;
                              })
                            }
                            className="mt-1 w-24 rounded border bg-white px-1 py-1 text-[10px]"
                          >
                            <option value="">All colors</option>
                            {newProduct.colors
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
                      )}
                      {imagePreviews.related.map((preview, index) => (
                        <div key={preview}>
                          <img
                            src={preview}
                            alt={`Related product preview ${index + 1}`}
                            className="h-24 w-24 rounded-lg border object-cover"
                          />
                          <span className="mt-1 block text-[10px] text-gray-600">
                            Related image {index + 1}
                          </span>
                          <select
                            aria-label={`Assign related image ${index + 1} to a color`}
                            value={newImageColors[index + 1] || ""}
                            onChange={(event) =>
                              setNewImageColors((current) => {
                                const next = [...current];
                                next[index + 1] = event.target.value;
                                return next;
                              })
                            }
                            className="mt-1 w-24 rounded border bg-white px-1 py-1 text-[10px]"
                          >
                            <option value="">All colors</option>
                            {newProduct.colors
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
                  <label className="sm:col-span-2 text-xs font-medium text-gray-600">
                    Description
                    <textarea
                      required
                      rows="3"
                      value={newProduct.description}
                      onChange={(event) =>
                        setNewProduct({
                          ...newProduct,
                          description: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {savingProduct ? "Adding product..." : "Save product"}
                    </button>
                  </div>
                </form>
              )}
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
                <label className="relative sm:col-span-2 xl:col-span-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setProductPagination((current) => ({ ...current, page: 1 }));
                    }}
                    placeholder="Search products or brands..."
                    className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm text-gray-900"
                  />
                </label>
                <select
                  value={productCategory}
                  onChange={(event) => {
                    setProductCategory(event.target.value);
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                  aria-label="Filter products by category"
                >
                  <option value="">All categories</option>
                  {categoriesList.map((category) => (
                    <option key={category._id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={productStock}
                  onChange={(event) => {
                    setProductStock(event.target.value);
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                  aria-label="Filter products by stock"
                >
                  <option value="">Any stock</option>
                  <option value="in">In stock</option>
                  <option value="out">Out of stock</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productMinPrice}
                  onChange={(event) => {
                    setProductMinPrice(event.target.value);
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  placeholder="Min price"
                  aria-label="Minimum product price"
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productMaxPrice}
                  onChange={(event) => {
                    setProductMaxPrice(event.target.value);
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  placeholder="Max price"
                  aria-label="Maximum product price"
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                />
                <select
                  value={productSort}
                  onChange={(event) => {
                    setProductSort(event.target.value);
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                  aria-label="Sort products"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="price-asc">Price low to high</option>
                  <option value="price-desc">Price high to low</option>
                </select>
              </div>
              {(productSearch ||
                productCategory ||
                productStock ||
                productMinPrice ||
                productMaxPrice) && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch("");
                    setProductCategory("");
                    setProductStock("");
                    setProductMinPrice("");
                    setProductMaxPrice("");
                    setProductPagination((current) => ({ ...current, page: 1 }));
                  }}
                  className="mb-3 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b text-[10px] uppercase text-gray-400">
                    <tr>
                      <th className="pb-3">Product</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">Stock</th>
                      <th className="pb-3">Images</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productsList.map((prod) => (
                      <tr key={prod._id} className="hover:bg-gray-50/50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={prod.images?.[0]}
                              alt=""
                              className="h-12 w-12 rounded-lg border bg-gray-50 object-cover"
                            />
                            <div>
                              <p className="font-semibold text-gray-800">{prod.title}</p>
                              <p className="mt-1 text-[11px] text-gray-500">{prod.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-gray-500">{prod.category}</td>
                        <td className="font-bold text-gray-900">
                          ₹{Number(prod.price).toLocaleString("en-IN")}
                          <span className="ml-1 font-normal text-gray-400 line-through">
                            ₹{Number(prod.originalPrice).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold ${prod.stock > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                          >
                            {prod.stock > 0 ? `${prod.stock} in stock` : "Out of stock"}
                          </span>
                        </td>
                        <td className="text-gray-600">{prod.images?.length || 0}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setViewImageIndex(0);
                                setViewingProduct(prod);
                              }}
                              title="View product"
                              aria-label={`View ${prod.title}`}
                              className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditProduct(prod)}
                              title="Edit product"
                              aria-label={`Edit ${prod.title}`}
                              className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod._id)}
                              title="Delete product"
                              aria-label={`Delete ${prod.title}`}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {productsList.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-10 text-center text-gray-500">
                          {productPagination.total
                            ? "No products match these filters."
                            : "No products found. Add your first product to get started."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span>
                    Showing{" "}
                    {productPagination.total
                      ? (productPagination.page - 1) * productPagination.limit + 1
                      : 0}
                    –
                    {Math.min(
                      productPagination.page * productPagination.limit,
                      productPagination.total,
                    )}{" "}
                    of {productPagination.total} products
                  </span>
                  <select
                    value={productLimit}
                    onChange={(event) => {
                      const limit = Number(event.target.value);
                      setProductLimit(limit);
                      setProductPagination((current) => ({ ...current, page: 1 }));
                    }}
                    className="rounded border bg-white px-2 py-1"
                    aria-label="Products per page"
                  >
                    <option value="10">10 / page</option>
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    Page {productPagination.totalPages ? productPagination.page : 0} of{" "}
                    {productPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={productPagination.page <= 1}
                    onClick={() =>
                      setProductPagination((current) => ({
                        ...current,
                        page: current.page - 1,
                      }))
                    }
                    className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      !productPagination.totalPages ||
                      productPagination.page >= productPagination.totalPages
                    }
                    onClick={() =>
                      setProductPagination((current) => ({
                        ...current,
                        page: current.page + 1,
                      }))
                    }
                    className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === "orders" ? (
            /* Orders Module */
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-800 mb-5">
                All Store Orders
              </h3>
              <table className="w-full text-xs text-left">
                <thead className="border-b text-gray-400 uppercase text-[10px]">
                  <tr>
                    <th className="pb-3">Order ID</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ordersList.map((ord) => (
                    <tr key={ord._id}>
                      <td className="py-3 font-bold text-gray-800">
                        #{ord._id.slice(-6)}
                      </td>
                      <td className="text-gray-700">
                        {ord.customer?.name || "Customer"}
                      </td>
                      <td className="font-bold text-gray-900">
                        ₹{ord.totalAmount}
                      </td>
                      <td>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">
                          {ord.orderStatus}
                        </span>
                      </td>
                      <td>
                        <select
                          value={ord.orderStatus}
                          onChange={(e) =>
                            handleUpdateOrderStatus(ord._id, e.target.value)
                          }
                          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-gray-700 outline-none"
                        >
                          <option value="Processing">Processing</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {ordersList.length === 0 && (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500">No orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === "users" || activeTab === "sellers" ? (
            <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold capitalize text-gray-800">
                    {activeTab}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Search and manage registered {activeTab}.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {accountPagination.total} {activeTab}
                </span>
              </div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <label className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={accountSearch}
                    onChange={(event) => {
                      setAccountSearch(event.target.value);
                      setAccountPagination((current) => ({ ...current, page: 1 }));
                    }}
                    placeholder={`Search ${activeTab} by name or email...`}
                    aria-label={`Search ${activeTab}`}
                    className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm text-gray-900"
                  />
                </label>
                <select
                  value={accountSort}
                  onChange={(event) => {
                    setAccountSort(event.target.value);
                    setAccountPagination((current) => ({ ...current, page: 1 }));
                  }}
                  aria-label={`Sort ${activeTab}`}
                  className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <option value="newest">Newest joined</option>
                  <option value="oldest">Oldest joined</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="email-asc">Email A–Z</option>
                  <option value="email-desc">Email Z–A</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="border-b text-gray-400 uppercase text-[10px]">
                    <tr>
                      <th className="pb-3">Account</th>
                      <th className="pb-3">Contact</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Joined</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(activeTab === "users" ? usersList : sellersList).map((account) => (
                      <Fragment key={account._id}>
                        <tr className="hover:bg-gray-50/70">
                          <td className="py-3">
                            <p className="font-semibold text-gray-900">{account.name}</p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              ID {account._id.slice(-8)}
                              {account.sellerCode && ` · ${account.sellerCode}`}
                            </p>
                          </td>
                          <td>
                            <p className="text-gray-700">{account.email}</p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {account.phone || "No phone provided"}
                            </p>
                          </td>
                          <td>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold capitalize text-gray-700">
                              {account.role}
                            </span>
                          </td>
                          <td>
                            {account.role === "seller" && !account.sellerApproved ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                                Approval pending
                              </span>
                            ) : (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                  account.isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {account.isActive ? "Active" : "Inactive"}
                              </span>
                            )}
                          </td>
                          <td className="text-gray-600">
                            {account.createdAt
                              ? new Date(account.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingAccountId((current) =>
                                    current === account._id ? "" : account._id,
                                  )
                                }
                                className="rounded-lg px-2 py-1.5 font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                {viewingAccountId === account._id
                                  ? "Hide details"
                                  : "View details"}
                              </button>
                              {account.role === "seller" && !account.sellerApproved && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveSeller(account._id)}
                                  className="rounded-lg px-2 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
                                >
                                  Approve
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleUpdateAccountStatus(account)}
                                className={`rounded-lg px-2 py-1.5 font-semibold ${
                                  account.isActive
                                    ? "text-amber-700 hover:bg-amber-50"
                                    : "text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {account.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteUser(
                                    account._id,
                                    activeTab === "sellers" ? "seller" : "user",
                                  )
                                }
                                className="rounded-lg px-2 py-1.5 font-semibold text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                        {viewingAccountId === account._id && (
                          <tr key={`${account._id}-details`} className="bg-blue-50/40">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    Account email
                                  </p>
                                  <p className="mt-1 break-all text-xs text-gray-800">
                                    {account.email}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    Phone
                                  </p>
                                  <p className="mt-1 text-xs text-gray-800">
                                    {account.phone || "Not provided"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    {account.role === "seller" ? "Seller code" : "Account ID"}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-800">
                                    {account.sellerCode || account._id}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    Account status
                                  </p>
                                  <p className="mt-1 text-xs text-gray-800">
                                    {account.isActive ? "Active" : "Inactive"}
                                    {account.role === "seller" &&
                                      ` · ${account.sellerApproved ? "Approved" : "Approval pending"}`}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    Registered
                                  </p>
                                  <p className="mt-1 text-xs text-gray-800">
                                    {account.createdAt
                                      ? new Date(account.createdAt).toLocaleString()
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase text-gray-400">
                                    Saved addresses
                                  </p>
                                  <p className="mt-1 text-xs text-gray-800">
                                    {account.addresses?.length || 0}
                                  </p>
                                </div>
                              </div>
                              {!!account.addresses?.length && (
                                <div className="mt-4 border-t border-blue-100 pt-3">
                                  <p className="mb-2 text-[10px] font-semibold uppercase text-gray-400">
                                    Addresses
                                  </p>
                                  <div className="space-y-2">
                                    {account.addresses.map((address, index) => (
                                      <p
                                        key={address._id || index}
                                        className="text-xs text-gray-700"
                                      >
                                        <span className="font-semibold">
                                          {address.type || "Address"}:
                                        </span>{" "}
                                        {[address.street, address.city, address.state, address.pincode]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {(activeTab === "users" ? usersList : sellersList).length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-10 text-center text-gray-500">
                          {accountPagination.total
                            ? `No ${activeTab} match this search.`
                            : `No ${activeTab} registered yet.`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t pt-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span>
                    Showing{" "}
                    {accountPagination.total
                      ? (accountPagination.page - 1) * accountPagination.limit + 1
                      : 0}
                    –
                    {Math.min(
                      accountPagination.page * accountPagination.limit,
                      accountPagination.total,
                    )}{" "}
                    of {accountPagination.total}
                  </span>
                  <select
                    value={accountLimit}
                    onChange={(event) => {
                      setAccountLimit(Number(event.target.value));
                      setAccountPagination((current) => ({ ...current, page: 1 }));
                    }}
                    aria-label="Accounts per page"
                    className="rounded border bg-white px-2 py-1"
                  >
                    <option value="10">10 / page</option>
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    Page {accountPagination.totalPages ? accountPagination.page : 0} of{" "}
                    {accountPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={accountPagination.page <= 1}
                    onClick={() =>
                      setAccountPagination((current) => ({
                        ...current,
                        page: current.page - 1,
                      }))
                    }
                    aria-label="Previous accounts page"
                    className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={
                      !accountPagination.totalPages ||
                      accountPagination.page >= accountPagination.totalPages
                    }
                    onClick={() =>
                      setAccountPagination((current) => ({
                        ...current,
                        page: current.page + 1,
                      }))
                    }
                    aria-label="Next accounts page"
                    className="rounded-lg border p-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          ) : activeTab === "categories" ? (
            /* Categories Module */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddCategory}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-fit space-y-3"
              >
                <h4 className="text-xs font-bold text-gray-800 uppercase">
                  Create Category
                </h4>
                <input
                  type="text"
                  placeholder="Category Name (e.g. Footwear)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-xs outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-blue-700"
                >
                  Add Category
                </button>
              </form>
              <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <h4 className="text-xs font-bold text-gray-800 uppercase mb-4">
                  All Categories
                </h4>
                <div className="divide-y divide-gray-100">
                  {categoriesList.map((c) => (
                    <div
                      key={c.id || c._id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      {editingCategoryId === c._id ? (
                        <form
                          onSubmit={handleSaveCategory}
                          className="flex w-full flex-wrap items-center gap-2"
                        >
                          <input
                            autoFocus
                            required
                            value={editingCategoryName}
                            onChange={(event) =>
                              setEditingCategoryName(event.target.value)
                            }
                            aria-label={`Edit ${c.name} category name`}
                            className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs text-gray-900"
                          />
                          <button
                            type="submit"
                            disabled={savingCategory}
                            className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {savingCategory ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId("");
                              setEditingCategoryName("");
                            }}
                            disabled={savingCategory}
                            className="rounded-lg border px-3 py-2 font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <span className="font-semibold text-gray-800">
                              {c.name}
                            </span>
                            <span className="ml-3 text-gray-400">{c.slug}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditCategory(c)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-blue-50 hover:text-blue-700"
                              aria-label={`Edit ${c.name}`}
                              title="Edit category"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(c._id)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Delete ${c.name}`}
                              title="Delete category"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {categoriesList.length === 0 && (
                    <p className="py-8 text-center text-xs text-gray-500">
                      No categories yet. Create one to organize products.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "special-deals" ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-sm sm:p-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                  Merchandising
                </p>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Special deals
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Schedule product discounts for the storefront. Deals go live
                  and expire automatically, with the discounted price verified
                  again at checkout.
                </p>
              </div>
              <SpecialDealsModule />
            </div>
          ) : activeTab === "info-pages" ? (
            <InfoPagesModule />
          ) : activeTab === "coupons" ? (
            /* Coupons Module */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <form
                onSubmit={handleAddCoupon}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm h-fit space-y-3 text-xs"
              >
                <h4 className="font-bold text-gray-800 uppercase text-[11px]">
                  Create Discount Coupon
                </h4>
                <input
                  type="text"
                  placeholder="CODE (e.g. SAVE20)"
                  value={newCoupon.code}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, code: e.target.value })
                  }
                  className="w-full border rounded-xl px-3 py-2 outline-none uppercase font-mono"
                  required
                />
                <input
                  type="number"
                  placeholder="Discount %"
                  min="1"
                  max="100"
                  value={newCoupon.discount}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, discount: e.target.value })
                  }
                  className="w-full border rounded-xl px-3 py-2 outline-none"
                  required
                />
                <input
                  type="number"
                  placeholder="Min. Order Value (₹)"
                  min="0"
                  value={newCoupon.minSpend}
                  onChange={(e) =>
                    setNewCoupon({ ...newCoupon, minSpend: e.target.value })
                  }
                  className="w-full border rounded-xl px-3 py-2 outline-none"
                  required
                />
                <label className="block font-medium text-gray-600">
                  Valid from
                  <input
                    type="date"
                    value={newCoupon.startDate}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, startDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 font-normal text-gray-800"
                    required
                  />
                </label>
                <label className="block font-medium text-gray-600">
                  Valid through
                  <input
                    type="date"
                    value={newCoupon.expiryDate}
                    min={newCoupon.startDate || undefined}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, expiryDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 font-normal text-gray-800"
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-blue-700"
                >
                  Save Coupon
                </button>
              </form>
              <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm text-xs">
                <h4 className="font-bold text-gray-800 uppercase text-[11px] mb-4">
                  Active Store Coupons
                </h4>
                <div className="divide-y divide-gray-100">
                  {couponsList.map((cp) => (
                    <div
                      key={cp.id || cp._id}
                      className="py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg mr-2">
                          {cp.code}
                        </span>
                        <span className="text-gray-600 font-medium">
                          {cp.discount || cp.discountPercentage}% Off
                        </span>
                        <p className="mt-1 text-[10px] text-gray-500">
                          Valid {cp.startDate ? new Date(cp.startDate).toLocaleDateString() : "immediately"} through{" "}
                          {cp.expiryDate ? new Date(cp.expiryDate).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleCoupon(cp)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${cp.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {cp.isActive ? "Active" : "Inactive"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === "banners" ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <form
                onSubmit={handleSaveBanner}
                className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-1"
              >
                <div>
                  <h3 className="text-sm font-bold text-gray-800">
                    {editingBannerId ? "Edit homepage banner" : "Add homepage banner"}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Active banners rotate in the homepage slider. You can keep
                    up to 10 promotions live at once.
                  </p>
                </div>
                <label className="block text-xs font-semibold text-gray-600">
                  Badge text
                  <input
                    required
                    maxLength={32}
                    value={bannerForm.eyebrow}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        eyebrow: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Heading
                  <input
                    required
                    maxLength={80}
                    value={bannerForm.title}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Description
                  <textarea
                    maxLength={180}
                    rows={2}
                    value={bannerForm.description}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Button label
                  <input
                    required
                    maxLength={24}
                    value={bannerForm.buttonLabel}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        buttonLabel: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Internal destination
                  <input
                    required
                    maxLength={200}
                    placeholder="/category"
                    value={bannerForm.link}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        link: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Upload banner image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(event) =>
                      setBannerImageFile(event.target.files?.[0] || null)
                    }
                    className="mt-1 block w-full rounded-lg border px-3 py-2 text-xs font-normal text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
                  />
                  <span className="mt-1 block font-normal text-gray-500">
                    JPEG, PNG, WebP, or GIF; maximum 5 MB.
                    {bannerImageFile ? ` Selected: ${bannerImageFile.name}` : ""}
                  </span>
                </label>
                <label className="block text-xs font-semibold text-gray-600">
                  Or use an HTTPS image URL
                  <input
                    type="text"
                    maxLength={2048}
                    placeholder="https://example.com/banner.jpg"
                    value={bannerForm.imageUrl}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        imageUrl: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                  <span className="mt-1 block font-normal text-gray-500">
                    Existing uploaded image paths are valid here. Enter an
                    HTTPS URL to replace the image, or upload a new file.
                  </span>
                </label>
                {bannerForm.imageUrl && !bannerImageFile && (
                  <img
                    src={resolveMediaUrl(bannerForm.imageUrl)}
                    alt=""
                    className="h-24 w-full rounded-lg border bg-gray-50 object-contain"
                  />
                )}
                <label className="block text-xs font-semibold text-gray-600">
                  Image description
                  <input
                    required
                    maxLength={120}
                    value={bannerForm.imageAlt}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        imageAlt: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-gray-600">
                    Placement
                    <select
                      value={bannerForm.placement}
                      onChange={(event) =>
                        setBannerForm((current) => ({
                          ...current,
                          placement: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal text-gray-900"
                    >
                      <option value="main">Main</option>
                      <option value="side">Side</option>
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-gray-600">
                    Theme
                    <select
                      value={bannerForm.theme}
                      onChange={(event) =>
                        setBannerForm((current) => ({
                          ...current,
                          theme: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal text-gray-900"
                    >
                      <option value="indigo">Indigo</option>
                      <option value="blue">Blue</option>
                      <option value="rose">Rose</option>
                      <option value="amber">Amber</option>
                      <option value="emerald">Emerald</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-semibold text-gray-600">
                  Display order (0-100)
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={bannerForm.sortOrder}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        sortOrder: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-gray-900"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                  <input
                    type="checkbox"
                    checked={bannerForm.isActive}
                    onChange={(event) =>
                      setBannerForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Active on the storefront
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingBanner}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingBanner
                      ? "Saving..."
                      : editingBannerId
                        ? "Save changes"
                        : "Create banner"}
                  </button>
                  {editingBannerId && (
                    <button
                      type="button"
                      disabled={savingBanner}
                      onClick={() => {
                        setBannerForm(emptyBannerForm);
                        setBannerImageFile(null);
                        setEditingBannerId("");
                      }}
                      className="rounded-xl border px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm xl:col-span-2">
                <div className="border-b border-gray-100 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        Homepage banners
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Review and manage the promotions currently configured
                        for your storefront.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                        {bannersList.length} total
                      </span>
                      <span className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                        {bannersList.filter((banner) => banner.isActive).length}{" "}
                        active
                      </span>
                    </div>
                  </div>
                  <label className="relative mt-4 block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={bannerSearch}
                      onChange={(event) => setBannerSearch(event.target.value)}
                      placeholder="Search banners by title, badge, or placement..."
                      aria-label="Search homepage banners"
                      className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  {filteredBanners.map((banner) => (
                    <article
                      key={banner._id}
                      className="group flex flex-col gap-4 rounded-xl border border-gray-200 p-3 transition hover:border-blue-200 hover:shadow-sm sm:flex-row sm:items-center"
                    >
                      <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-24 sm:w-36">
                        <img
                          src={resolveMediaUrl(banner.imageUrl)}
                          alt={banner.imageAlt}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              banner.placement === "main"
                                ? "bg-indigo-50 text-indigo-700"
                                : "bg-sky-50 text-sky-700"
                            }`}
                          >
                            {banner.placement} placement
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              banner.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                banner.isActive ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            />
                            {banner.isActive ? "Live" : "Draft"}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Order {banner.sortOrder}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {banner.eyebrow}
                        </p>
                        <h4 className="mt-0.5 truncate text-sm font-bold text-gray-900">
                          {banner.title}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {banner.description || "No description provided"}
                        </p>
                        <p className="mt-2 truncate text-[10px] text-gray-400">
                          Destination: {banner.link}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1 border-t border-gray-100 pt-2 sm:border-0 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleEditBanner(banner)}
                          aria-label={`Edit ${banner.title}`}
                          title="Edit banner"
                          className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(banner)}
                          aria-label={`Delete ${banner.title}`}
                          title="Delete banner"
                          className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {filteredBanners.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center">
                      <Megaphone className="mx-auto h-8 w-8 text-gray-300" />
                      <p className="mt-3 text-sm font-semibold text-gray-700">
                        {bannersList.length
                          ? "No banners match your search"
                          : "No banners configured yet"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {bannersList.length
                          ? "Try a different title, badge, or placement."
                          : "Create a banner to start promoting products on your storefront."}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : activeTab === "newsletter" ? (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
                      <Mail className="h-3.5 w-3.5" />
                      Audience & campaigns
                    </span>
                    <h2 className="mt-4 text-2xl font-bold tracking-tight">
                      Newsletter studio
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Send product news and promotions to people who opted in.
                      Messages are sent individually and include a one-click
                      unsubscribe option.
                    </p>
                  </div>
                  <div className="min-w-48 rounded-2xl border border-white/10 bg-white/10 p-4">
                    <p className="text-xs font-medium text-slate-300">
                      Subscribed audience
                    </p>
                    <p className="mt-1 text-3xl font-bold">
                      {newsletterSubscriberTotal.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Active opted-in addresses
                    </p>
                  </div>
                </div>
              </section>

              {newsletterStatus && !newsletterStatus.emailConfigured && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">Email delivery is not configured</p>
                    <p className="mt-1 text-xs leading-5">
                      Add the required SMTP values to the backend environment and
                      restart the server. Missing:{" "}
                      {(newsletterStatus.emailConfiguration?.missingVariables || [])
                        .join(", ") || "none"}.
                      {(newsletterStatus.emailConfiguration?.placeholderVariables || [])
                        .length > 0 &&
                        ` Replace placeholder values for ${newsletterStatus.emailConfiguration.placeholderVariables.join(", ")}.`}
                    </p>
                  </div>
                </div>
              )}
              {newsletterStatus?.emailConfigured &&
                !newsletterStatus.publicApiUrlValid && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
                  >
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">Public API URL needs configuration</p>
                      <p className="mt-1 text-xs leading-5">
                        Set PUBLIC_API_URL to your publicly reachable API base
                        address ending in /api. Production campaign links require
                        HTTPS so banner images and unsubscribe links work for
                        subscribers.
                      </p>
                    </div>
                  </div>
                )}

              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                <form
                  onSubmit={handleCreateNewsletterCampaign}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                      Compose campaign
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-gray-900">
                      Create newsletter or promotion
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Select an active homepage banner to include its image and
                      call-to-action, or send a text newsletter.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-semibold text-gray-600">
                      Email subject
                      <input
                        required
                        maxLength={160}
                        value={newsletterForm.subject}
                        onChange={(event) =>
                          setNewsletterForm((current) => ({
                            ...current,
                            subject: event.target.value,
                          }))
                        }
                        placeholder="A fresh update from SHOPMART"
                        className="mt-1.5 w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-600">
                      Newsletter message
                      <textarea
                        maxLength={5000}
                        rows={6}
                        value={newsletterForm.message}
                        onChange={(event) =>
                          setNewsletterForm((current) => ({
                            ...current,
                            message: event.target.value,
                          }))
                        }
                        placeholder="Share new arrivals, store updates, or a personal note with your subscribers..."
                        className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 px-3.5 py-3 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      />
                      <span className="mt-1 block text-right font-normal text-gray-400">
                        {newsletterForm.message.length}/5000
                      </span>
                    </label>
                    <label className="block text-xs font-semibold text-gray-600">
                      Featured homepage promotion (optional)
                      <select
                        value={newsletterForm.bannerId}
                        onChange={(event) =>
                          setNewsletterForm((current) => ({
                            ...current,
                            bannerId: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="">Newsletter only — no banner</option>
                        {bannersList
                          .filter((banner) => banner.isActive)
                          .map((banner) => (
                            <option key={banner._id} value={banner._id}>
                              {banner.title} · {banner.placement} banner
                            </option>
                          ))}
                      </select>
                      <span className="mt-1 block font-normal text-gray-500">
                        Need a new promotion?{" "}
                        <button
                          type="button"
                          onClick={() => setActiveTab("banners")}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Create it in Homepage Banners.
                        </button>
                      </span>
                    </label>

                    {newsletterForm.bannerId &&
                      bannersList.find(
                        (banner) => banner._id === newsletterForm.bannerId,
                      ) && (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                          {(() => {
                            const banner = bannersList.find(
                              (item) => item._id === newsletterForm.bannerId,
                            );
                            return (
                              <>
                                <img
                                  src={resolveMediaUrl(banner.imageUrl)}
                                  alt={banner.imageAlt}
                                  className="h-40 w-full object-cover"
                                />
                                <div className="p-4">
                                  <p className="text-sm font-bold text-gray-900">
                                    {banner.title}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {banner.description}
                                  </p>
                                  <p className="mt-2 text-[11px] font-semibold text-blue-700">
                                    Button: {banner.buttonLabel} → {banner.link}
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                    <button
                      type="submit"
                      disabled={
                        sendingNewsletter ||
                        !newsletterStatus?.emailConfigured ||
                          !newsletterStatus?.publicApiUrlValid ||
                          newsletterSubscriberTotal === 0
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {sendingNewsletter
                        ? "Queuing campaign..."
                        : `Review & send to ${newsletterSubscriberTotal.toLocaleString("en-IN")} subscribers`}
                    </button>
                    <p className="text-center text-[11px] leading-5 text-gray-500">
                      You’ll confirm the recipient count before sending. Delivery
                      starts in the background and can be tracked below.
                    </p>
                  </div>
                </form>

                <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-100 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                          Permission-based audience
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-gray-900">
                          Newsletter subscribers
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadTabData("newsletter")}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                      >
                        Refresh status & list
                      </button>
                    </div>
                    <form
                      className="relative mt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setNewsletterPagination((current) => ({
                          ...current,
                          page: 1,
                        }));
                        setNewsletterSubscriberSearch(
                          newsletterSubscriberSearchInput.trim(),
                        );
                      }}
                    >
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={newsletterSubscriberSearchInput}
                        onChange={(event) =>
                          setNewsletterSubscriberSearchInput(event.target.value)
                        }
                        placeholder="Search subscribed email"
                        aria-label="Search newsletter subscribers"
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </form>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {newsletterSubscribers.map((subscriber) => (
                      <div
                        key={subscriber._id}
                        className="flex items-center justify-between gap-3 px-5 py-3.5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                            <Mail className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {subscriber.email}
                            </p>
                            <p className="mt-0.5 text-[11px] text-gray-400">
                              Subscribed{" "}
                              {new Date(subscriber.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                          Subscribed
                        </span>
                      </div>
                    ))}
                    {newsletterSubscribers.length === 0 && (
                      <div className="px-5 py-10 text-center">
                        <Mail className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-semibold text-gray-700">
                          No subscribers found
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Subscribers who opt in on the storefront will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
                    <span>
                      {newsletterPagination.total
                        ? `Page ${newsletterPagination.page} of ${newsletterPagination.totalPages}`
                        : "No matching subscribers"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={newsletterPagination.page <= 1}
                        onClick={() =>
                          setNewsletterPagination((current) => ({
                            ...current,
                            page: current.page - 1,
                          }))
                        }
                        className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40"
                        aria-label="Previous subscriber page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={
                          newsletterPagination.page >=
                          newsletterPagination.totalPages
                        }
                        onClick={() =>
                          setNewsletterPagination((current) => ({
                            ...current,
                            page: current.page + 1,
                          }))
                        }
                        className="rounded-lg border border-gray-200 p-1.5 disabled:opacity-40"
                        aria-label="Next subscriber page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                      SMTP handoff monitoring
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-gray-900">
                      Recent campaigns
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Accepted by the mail server does not confirm inbox delivery.
                      Check spam and your SMTP provider’s delivery or bounce logs.
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    Last {newsletterCampaigns.length} campaigns
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400">
                      <tr>
                        <th className="px-5 py-3">Campaign</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Recipients</th>
                        <th className="px-3 py-3">Accepted by SMTP</th>
                        <th className="px-3 py-3">Failed</th>
                        <th className="px-5 py-3 text-right">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {newsletterCampaigns.map((campaign) => {
                        const statusStyle = {
                          queued: "bg-amber-50 text-amber-700",
                          sending: "bg-blue-50 text-blue-700",
                          sent: "bg-emerald-50 text-emerald-700",
                          partial: "bg-orange-50 text-orange-700",
                          failed: "bg-red-50 text-red-700",
                        }[campaign.status] || "bg-gray-100 text-gray-600";
                        const StatusIcon =
                          campaign.status === "sent"
                            ? CheckCircle2
                            : campaign.status === "failed" ||
                                campaign.status === "partial"
                              ? AlertCircle
                              : Clock3;
                        return (
                          <tr key={campaign._id} className="align-top">
                            <td className="max-w-xs px-5 py-4">
                              <p className="truncate font-semibold text-gray-900">
                                {campaign.subject}
                              </p>
                              <p className="mt-1 truncate text-[11px] text-gray-500">
                                {campaign.banner?.title || "Newsletter"}
                              </p>
                              {campaign.lastError && (
                                <p className="mt-1 text-[10px] text-red-600">
                                  {campaign.lastError}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold capitalize ${statusStyle}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {campaign.status}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-gray-700">
                              {(campaign.processedCount || 0) +
                                (campaign.skippedCount || 0)}
                              /{campaign.audienceCount || 0}
                              {!!campaign.skippedCount && (
                                <span className="mt-1 block text-[10px] text-gray-400">
                                  {campaign.skippedCount} unsubscribed during delivery
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4 font-semibold text-emerald-700">
                              {campaign.sentCount || 0}
                            </td>
                            <td className="px-3 py-4 text-red-600">
                              {campaign.failedCount || 0}
                            </td>
                            <td className="px-5 py-4 text-right text-gray-500">
                              {new Date(campaign.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                      {newsletterCampaigns.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-5 py-12 text-center text-sm text-gray-500"
                          >
                            No campaigns have been sent yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : activeTab === "settings" ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-gray-800">
                  Account settings
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Manage your personal details and security settings.
                </p>
              </section>
                <ProfileSettings />
                <AccountSecurity />
            </div>
          ) : (
            /* Generic Data View for Users / Sellers / Payments */
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-gray-800 mb-2 capitalize">
                {activeTab} Management
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                {activeTab === "payments"
                  ? "Payment transactions are recorded with each order. Dedicated payment reporting is not available yet."
                  : activeTab === "reports"
                    ? "Reporting and exports are not available yet."
                    : "System-wide settings are not available yet."}
              </p>
              <div className="h-32 border border-dashed border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-400">
                No tools are configured for this section.
              </div>
            </div>
          )}
        </main>
      </div>

      {viewingProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewingProduct(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 id="product-detail-title" className="font-bold text-gray-900">
                  Product details
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Full product information and image gallery
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close product details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <div>
                <div className="flex h-80 items-center justify-center overflow-hidden rounded-xl border bg-gray-50">
                  {viewingProduct.images?.[viewImageIndex] ? (
                    <img
                      src={viewingProduct.images[viewImageIndex]}
                      alt={`${viewingProduct.title} image ${viewImageIndex + 1}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-gray-400">No image available</span>
                  )}
                </div>
                {!!viewingProduct.images?.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {viewingProduct.images.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setViewImageIndex(index)}
                        aria-label={`Show product image ${index + 1}`}
                        aria-pressed={viewImageIndex === index}
                        className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${viewImageIndex === index ? "border-blue-600" : "border-transparent"}`}
                      >
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {viewingProduct.category}
                  </span>
                  <h3 className="mt-3 text-xl font-bold text-gray-900">
                    {viewingProduct.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Brand: {viewingProduct.brand || "—"}
                  </p>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-gray-900">
                    ₹{Number(viewingProduct.price).toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-gray-400 line-through">
                    ₹{Number(viewingProduct.originalPrice).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 text-sm">
                  <span className="font-semibold text-gray-800">Inventory: </span>
                  <span className={viewingProduct.stock > 0 ? "text-green-700" : "text-red-700"}>
                    {viewingProduct.stock > 0
                      ? `${viewingProduct.stock} units available`
                      : "Out of stock"}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">Description</h4>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                    {viewingProduct.description || "No description provided."}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 border-t pt-4 text-xs">
                  <div>
                    <dt className="text-gray-500">Product ID</dt>
                    <dd className="mt-1 break-all font-medium text-gray-800">{viewingProduct._id}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Created</dt>
                    <dd className="mt-1 font-medium text-gray-800">
                      {viewingProduct.createdAt
                        ? new Date(viewingProduct.createdAt).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => handleEditProduct(viewingProduct)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                  Edit product
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSaveProductEdit}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h2 id="edit-product-title" className="font-bold text-gray-900">
                  Edit product
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Update product details and manage its image gallery
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close edit product"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["title", "Product name", "text"],
                ["brand", "Brand", "text"],
                ["originalPrice", "Original price (₹)", "number"],
                ["specialDiscountPercentage", "Special deal discount (%)", "number"],
                ["price", "Selling price (₹)", "number"],
                ["stock", "Stock quantity", "number"],
              ].map(([field, label, type]) => (
                <label key={field} className="text-xs font-medium text-gray-600">
                  {label}
                  <input
                    required={field !== "specialDiscountPercentage"}
                    type={type}
                    min={
                      field === "originalPrice"
                        ? "0.01"
                        : field === "price"
                          ? "0.01"
                          : field === "specialDiscountPercentage"
                            ? "0"
                          : field === "stock"
                            ? "0"
                            : undefined
                    }
                    max={field === "specialDiscountPercentage" ? "99" : undefined}
                    step={["price", "originalPrice"].includes(field) ? "0.01" : field === "specialDiscountPercentage" ? "1" : undefined}
                    value={editProductForm[field] ?? ""}
                    disabled={
                      field === "price" &&
                      Number(editProductForm.specialDiscountPercentage) > 0
                    }
                    onChange={(event) =>
                      setEditProductForm((current) => {
                        const updated = {
                          ...current,
                          [field]: event.target.value,
                        };
                        if (
                          ["originalPrice", "specialDiscountPercentage"].includes(field) &&
                          Number(updated.specialDiscountPercentage) > 0
                        ) {
                          updated.price = getDealPrice(
                            updated.originalPrice,
                            updated.specialDiscountPercentage,
                          );
                        } else if (
                          field === "specialDiscountPercentage" &&
                          Number(current.specialDiscountPercentage) > 0
                        ) {
                          updated.price = updated.originalPrice;
                        }
                        return updated;
                      })
                    }
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-slate-100"
                  />
                  {field === "specialDiscountPercentage" && (
                    <span className="mt-1 block font-normal text-slate-500">
                      The deal price is calculated from the original price.
                    </span>
                  )}
                </label>
              ))}
              {[
                ["sizes", "Available sizes (comma-separated)", "S, M, L, XL"],
                ["colors", "Available colors (comma-separated)", "Black, Blue"],
              ].map(([field, label, placeholder]) => (
                <label key={field} className="text-xs font-medium text-gray-600">
                  {label}
                  <input
                    value={editProductForm[field] || ""}
                    onChange={(event) =>
                      setEditProductForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                  />
                </label>
              ))}
              <label className="text-xs font-medium text-gray-600">
                Category
                <select
                  required
                  value={editProductForm.category || ""}
                  onChange={(event) =>
                    setEditProductForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                >
                  {editProductForm.category &&
                    !categoriesList.some(
                      (category) => category.name === editProductForm.category,
                    ) && (
                      <option value={editProductForm.category}>
                        {editProductForm.category}
                      </option>
                    )}
                  {categoriesList
                    .filter((category) => category.isActive !== false)
                    .map((category) => (
                      <option key={category._id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                </select>
                {categoriesError && (
                  <span role="alert" className="mt-1 block text-[11px] text-red-600">
                    {categoriesError}
                  </span>
                )}
              </label>
              <label className="text-xs font-medium text-gray-600 sm:col-span-2">
                Description
                <textarea
                  required
                  rows="4"
                  value={editProductForm.description || ""}
                  onChange={(event) =>
                    setEditProductForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700">
                    Product images ({retainedEditImages.length + newEditImages.length}/6)
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    First image is the main product image
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {retainedEditImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="relative">
                      <img
                        src={image}
                        alt={`Product image ${index + 1}`}
                        className="h-20 w-20 rounded-lg border object-cover"
                      />
                      {index === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[9px] text-white">
                          Main image
                        </span>
                      )}
                      <select
                        aria-label={`Assign existing image ${index + 1} to a color`}
                        value={retainedImageColors[index] || ""}
                        onChange={(event) =>
                          setRetainedImageColors((current) =>
                            current.map((color, imageIndex) =>
                              imageIndex === index ? event.target.value : color,
                            ),
                          )
                        }
                        className="mt-1 block w-20 rounded border bg-white px-1 py-1 text-[10px]"
                      >
                        <option value="">All colors</option>
                        {(editProductForm.colors || "")
                          .split(",")
                          .map((color) => color.trim())
                          .filter(Boolean)
                          .map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setRetainedEditImages((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index),
                          );
                          setRetainedImageColors((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index),
                          );
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"
                        aria-label={`Remove existing image ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {newEditImages.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="relative">
                      <img
                        src={editImagePreviews[index]}
                        alt={`New product image ${index + 1}`}
                        className="h-20 w-20 rounded-lg border object-cover"
                      />
                      <select
                        aria-label={`Assign new image ${index + 1} to a color`}
                        value={newEditImageColors[index] || ""}
                        onChange={(event) =>
                          setNewEditImageColors((current) => {
                            const next = [...current];
                            next[index] = event.target.value;
                            return next;
                          })
                        }
                        className="mt-1 block w-20 rounded border bg-white px-1 py-1 text-[10px]"
                      >
                        <option value="">All colors</option>
                        {(editProductForm.colors || "")
                          .split(",")
                          .map((color) => color.trim())
                          .filter(Boolean)
                          .map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setNewEditImages((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index),
                          );
                          setNewEditImageColors((current) =>
                            current.filter((_, imageIndex) => imageIndex !== index),
                          );
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"
                        aria-label={`Remove new image ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-medium text-gray-600">
                  Add more images
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={(event) => {
                      const remaining =
                        6 - retainedEditImages.length - newEditImages.length;
                      const selected = Array.from(event.target.files || []);
                      if (selected.length > remaining) {
                        setEditError(
                          `You can add up to ${Math.max(remaining, 0)} more image(s).`,
                        );
                        event.target.value = "";
                        return;
                      }
                      setEditError("");
                      setNewEditImages((current) => [...current, ...selected]);
                      setNewEditImageColors((current) => [
                        ...current,
                        ...selected.map(() => ""),
                      ]);
                      event.target.value = "";
                    }}
                    className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-blue-700"
                  />
                  <span className="mt-1 block font-normal text-gray-500">
                    JPEG, PNG, WebP, or GIF · up to 5 MB each
                  </span>
                </label>
              </div>
              {(editError || errorMessage) && (
                <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {editError || errorMessage}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingEdit ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Footer Strip */}
      <footer className="bg-[#0B1528] text-gray-400 py-6 text-xs text-center border-t border-gray-800">
        © {new Date().getFullYear()} SHOPMART Admin Portal. Confidential &
        Protected.
      </footer>
    </div>
  );
}
