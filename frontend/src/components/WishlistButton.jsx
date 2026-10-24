import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";

export default function WishlistButton({ product, className = "" }) {
  const { user } = useAuth();
  const { isSaved, toggle } = useWishlist();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const saved = isSaved(product._id);

  const handleClick = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (user.role !== "customer") {
      setError("Only customer accounts can use a wishlist.");
      return;
    }
    setError("");
    try {
      await toggle(product);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={saved}
        title={error || (saved ? "Remove from wishlist" : "Add to wishlist")}
        className={`rounded-full border bg-white/95 p-2 shadow-sm transition hover:scale-105 ${
          saved
            ? "border-rose-200 text-rose-600"
            : "border-gray-200 text-gray-500 hover:border-rose-200 hover:text-rose-600"
        }`}
      >
        <Heart className="h-4 w-4" fill={saved ? "currentColor" : "none"} />
      </button>
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
}
