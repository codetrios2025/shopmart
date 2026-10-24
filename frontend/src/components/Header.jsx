import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { resolveMediaUrl } from "../api/client";

export default function Header({ roleTag }) {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/category?search=${encodeURIComponent(query)}` : "/category");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white shadow-sm">
            S
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            SHOP<span className="text-blue-600">MART</span>
          </span>
          {roleTag && (
            <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {roleTag}
            </span>
          )}
        </Link>

        <form
          onSubmit={submitSearch}
          role="search"
          className="order-3 w-full lg:order-none lg:mx-auto lg:max-w-xl lg:flex-1"
        >
          <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
            <Search className="ml-4 h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Search for products, brands and more..."
              aria-label="Search products"
              className="w-full bg-transparent px-3 py-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        <nav aria-label="Account and shopping" className="flex shrink-0 items-center gap-3 text-sm sm:gap-5">
          {user ? (
            <>
              <Link
                to={
                  user.role === "admin"
                    ? "/admin"
                    : user.role === "seller"
                      ? "/seller"
                      : "/customer"
                }
                aria-label={`Open ${user.name}'s profile`}
                title={`${user.name}'s profile`}
                className="flex items-center gap-2 text-slate-600 transition hover:text-blue-700"
              >
                {user.profileImage ? (
                  <img
                    src={resolveMediaUrl(user.profileImage)}
                    alt=""
                    className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                    <User className="h-4 w-4" />
                  </span>
                )}
                <span className="hidden max-w-24 truncate text-xs font-semibold sm:inline">
                  {user.name.split(" ")[0]}
                </span>
              </Link>
              <button
                onClick={logout}
                className="text-xs font-semibold text-slate-500 transition hover:text-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="flex items-center gap-2 text-slate-600 transition hover:text-blue-700"
            >
              <User className="h-5 w-5" />
              <span className="hidden text-xs font-semibold sm:inline">Sign in</span>
            </button>
          )}

          <Link
            to="/cart"
            className="relative flex items-center gap-2 text-slate-600 transition hover:text-blue-700"
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="hidden text-xs font-semibold sm:inline">Cart</span>
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
              {itemCount}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
