import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import api from "../api/client";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (user?.role !== "customer") {
      setItems([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/customer/wishlist");
      if (sequence === requestSequence.current) {
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (requestError) {
      if (sequence === requestSequence.current) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load your wishlist.",
        );
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  const isSaved = useCallback(
    (productId) =>
      items.some((item) => String(item._id) === String(productId)),
    [items],
  );

  const toggle = useCallback(
    async (product) => {
      if (user?.role !== "customer") {
        throw new Error("Sign in with a customer account to use your wishlist.");
      }
      const productId = String(product._id);
      const wasSaved = isSaved(productId);
      setError("");
      try {
        if (wasSaved) {
          await api.delete(`/customer/wishlist/${productId}`);
          setItems((current) =>
            current.filter((item) => String(item._id) !== productId),
          );
          return false;
        }
        await api.put(`/customer/wishlist/${productId}`);
        setItems((current) =>
          current.some((item) => String(item._id) === productId)
            ? current
            : [product, ...current],
        );
        return true;
      } catch (requestError) {
        const message =
          requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update your wishlist.";
        setError(message);
        throw new Error(message);
      }
    },
    [isSaved, user?.role],
  );

  const value = useMemo(
    () => ({ items, error, loading, isSaved, toggle, refresh }),
    [items, error, loading, isSaved, toggle, refresh],
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
