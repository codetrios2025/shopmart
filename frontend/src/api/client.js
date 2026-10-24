import axios from "axios";
import { showToast } from "../utils/toast";

const apiBaseURL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: apiBaseURL,
});

const successMessageFor = (response, method) => {
  if (response.data?.message) return response.data.message;
  const path = response.config.url || "";
  if (path.includes("/orders/verify")) return "Payment confirmed successfully.";
  if (path.includes("/orders")) return "Checkout started successfully.";
  if (path.includes("/customer/addresses")) {
    return method === "delete"
      ? "Address removed successfully."
      : "Address saved successfully.";
  }
  if (path.includes("/customer/wishlist")) {
    return method === "delete"
      ? "Product removed from your wishlist."
      : "Product added to your wishlist.";
  }
  if (path.includes("/auth/change-password")) {
    return "Password updated successfully.";
  }
  if (path.includes("/auth/login")) return "Welcome back!";
  if (path.includes("/auth/register")) {
    return "Your account was created successfully.";
  }
  if (method === "delete") return "Deleted successfully.";
  return "Saved successfully.";
};

export const resolveMediaUrl = (url) => {
  if (!url?.startsWith("/uploads/")) return url;
  const apiOrigin = new URL(apiBaseURL, window.location.origin).origin;
  return new URL(url, apiOrigin).toString();
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("shopmart_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    if (method && method !== "get" && method !== "head" && method !== "options") {
      showToast(successMessageFor(response, method), "success");
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.response
        ? `Request failed (${error.response.status}). Please try again.`
        : "Unable to reach the server. Check your connection and try again.");
    showToast(message, "error");
    return Promise.reject(error);
  },
);

export default api;
