import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { showToast } from "../utils/toast";

const CartContext = createContext(null);

const readCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("shopmart_cart") || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(readCart);

  useEffect(() => {
    localStorage.setItem("shopmart_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const addItem = useCallback((product, options = {}) => {
    const productId = product._id || product.productId;
    if (!productId) {
      showToast("Unable to add this product to your cart.", "error");
      throw new Error("Product is missing an id");
    }

    const colorImage = product.colorImages?.find(
      (group) => group.color === options.color && group.images?.length,
    )?.images?.[0];
    const item = {
      _id: `${productId}:${options.size || ""}:${options.color || ""}`,
      productId,
      title: product.title,
      brand: product.brand,
      price: product.dealPrice ?? product.price,
      originalPrice: product.dealPrice ? product.price : product.originalPrice || product.price,
      image: colorImage || product.images?.[0] || product.image || "",
      size: options.size || "",
      color: options.color || "",
      quantity: 1,
      seller:
        typeof product.seller === "object"
          ? product.seller?._id
          : product.seller,
    };

    setCartItems((current) => {
      const existing = current.find((entry) => entry._id === item._id);
      return existing
        ? current.map((entry) =>
            entry._id === item._id
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry,
          )
        : [...current, item];
    });
    showToast(`${product.title} added to your cart.`, "success");
  }, []);

  const updateProductPricing = useCallback((productId, product) => {
    setCartItems((current) =>
      current.map((item) => {
        if (String(item.productId) !== String(productId)) return item;
        const colorImages = product.colorImages?.find(
          (group) => group.color === item.color,
        )?.images;
        const assignedImages =
          product.colorImages?.flatMap((group) => group.images || []) || [];
        const sharedImage = product.images?.find(
          (image) => !assignedImages.includes(image),
        );
        const nextPrice = product.dealPrice ?? product.price;
        const nextOriginalPrice = product.dealPrice
          ? product.price
          : product.originalPrice || product.price;
        const nextImage =
          colorImages?.[0] ||
          sharedImage ||
          product.images?.[0] ||
          item.image;
        if (
          item.price === nextPrice &&
          item.originalPrice === nextOriginalPrice &&
          item.image === nextImage
        ) {
          return item;
        }
        return {
          ...item,
          price: nextPrice,
          originalPrice: nextOriginalPrice,
          image: nextImage,
        };
      }),
    );
  }, []);

  const updateQuantity = useCallback((id, delta) => {
    const currentItem = cartItems.find((item) => item._id === id);
    if (!currentItem) return;
    setCartItems((current) =>
      current
        .map((item) =>
          item._id === id
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    showToast(
      delta < 0 && currentItem.quantity <= 1
        ? `${currentItem.title} removed from your cart.`
        : "Cart quantity updated.",
      "success",
    );
  }, [cartItems]);

  const removeItem = useCallback((id) => {
    const removedItem = cartItems.find((item) => item._id === id);
    setCartItems((current) => current.filter((item) => item._id !== id));
    if (removedItem) showToast(`${removedItem.title} removed from your cart.`);
  }, [cartItems]);

  const clearCart = () => setCartItems([]);

  const value = useMemo(
    () => ({
      cartItems,
      itemCount: cartItems.reduce((total, item) => total + item.quantity, 0),
      addItem,
      updateProductPricing,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [cartItems, addItem, updateProductPricing, updateQuantity, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
