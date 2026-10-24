import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import AccountSecurity from "../components/AccountSecurity";
import ProfileSettings from "../components/ProfileSettings";
import { useLocation } from "react-router-dom";
import {
  Heart,
  LayoutDashboard,
  MapPin,
  Package,
  Settings,
  Trash2,
} from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import ListPagination from "../components/ListPagination";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toggle: toggleWishlist } = useWishlist();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [ordersPagination, setOrdersPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [wishlist, setWishlist] = useState([]);
  const [wishlistError, setWishlistError] = useState("");
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistPagination, setWishlistPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [addresses, setAddresses] = useState([]);
  const [addressError, setAddressError] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    type: "Home",
    street: "",
    city: "",
    state: "",
    pincode: "",
  });

  const loadAddresses = async () => {
    setAddressError("");
    try {
      const { data } = await api.get("/customer/addresses");
      setAddresses(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setAddressError(
        requestError.response?.data?.message || "Unable to load saved addresses.",
      );
    }
  };

  const deleteAddress = async (addressId) => {
    setAddressError("");
    try {
      const { data } = await api.delete(`/customer/addresses/${addressId}`);
      setAddresses(data.addresses);
    } catch (requestError) {
      setAddressError(
        requestError.response?.data?.message || "Unable to delete address.",
      );
    }
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    setSavingAddress(true);
    setAddressError("");
    try {
      const { data } = await api.post("/customer/addresses", addressForm);
      setAddresses((current) => [...current, data]);
      setAddressForm({
        type: "Home",
        street: "",
        city: "",
        state: "",
        pincode: "",
      });
      setShowAddressForm(false);
    } catch (requestError) {
      setAddressError(
        requestError.response?.data?.message || "Unable to save address.",
      );
    } finally {
      setSavingAddress(false);
    }
  };

  const removeWishlistItem = async (product) => {
    try {
      await toggleWishlist(product);
      setWishlist((current) =>
        current.filter((item) => String(item._id) !== String(product._id)),
      );
      setWishlistPagination((current) => {
        const total = Math.max(0, current.total - 1);
        const totalPages = Math.ceil(total / current.limit);
        return {
          ...current,
          total,
          totalPages,
          page: current.page > totalPages ? Math.max(1, totalPages) : current.page,
        };
      });
    } catch {
      // WishlistContext displays the request error.
    }
  };

  useEffect(() => {
    api
      .get("/orders/my-orders", {
        params: { page: ordersPagination.page, limit: ordersPagination.limit },
      })
      .then(({ data }) => {
        setOrders(data.orders);
        setOrdersPagination(data.pagination);
      })
      .catch((requestError) =>
        setError(
          requestError.response?.data?.message || "Unable to load your orders.",
        ),
      )
      .finally(() => setLoading(false));
  }, [ordersPagination.page, ordersPagination.limit]);

  useEffect(() => {
    loadAddresses();
  }, []);

  useEffect(() => {
    let active = true;
    setWishlistLoading(true);
    setWishlistError("");
    api
      .get("/customer/wishlist", {
        params: {
          page: wishlistPagination.page,
          limit: wishlistPagination.limit,
        },
      })
      .then(({ data }) => {
        if (!active) return;
        setWishlist(data.wishlist);
        setWishlistPagination(data.pagination);
      })
      .catch((requestError) => {
        if (active) {
          setWishlistError(
            requestError.response?.data?.message || "Unable to load your wishlist.",
          );
        }
      })
      .finally(() => {
        if (active) setWishlistLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wishlistPagination.page, wishlistPagination.limit]);

  const customerTabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "orders", label: "My orders", icon: Package },
    { id: "wishlist", label: "Wishlist", icon: Heart },
    { id: "addresses", label: "Addresses", icon: MapPin },
    { id: "profile", label: "Profile & security", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header roleTag="Customer" />
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 border-b border-gray-100 px-3 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Customer account
            </p>
            <p className="mt-1 truncate text-sm font-bold text-gray-900">
              {user?.name}
            </p>
          </div>
          <nav aria-label="Customer dashboard" className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {customerTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  activeTab === id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-blue-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {id === "orders" && ordersPagination.total > 0 && (
                  <span className={`ml-auto text-xs ${activeTab === id ? "text-blue-100" : "text-gray-400"}`}>
                    {ordersPagination.total}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">
          {activeTab === "overview" ? `Welcome, ${user?.name}` : customerTabs.find((tab) => tab.id === activeTab)?.label}
        </h1>
        {location.state?.accountNotice && (
          <p role="status" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            {location.state.accountNotice}
          </p>
        )}
        {location.state?.orderEmailNotice && (
          <p role="status" className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            {location.state.orderEmailNotice}
          </p>
        )}
        {activeTab === "overview" && <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="bg-white border rounded-xl p-5">
            <p className="text-sm text-gray-500">Orders</p>
            <p className="text-2xl font-bold mt-1">{ordersPagination.total}</p>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <p className="text-sm text-gray-500">Account email</p>
            <p className="font-semibold mt-2 break-all">{user?.email}</p>
          </div>
          <div className="bg-white border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Looking for something?</p>
              <p className="font-semibold mt-1">Explore the store</p>
            </div>
            <Link to="/category" className="text-sm text-blue-600 font-semibold">
              Shop now
            </Link>
          </div>
        </div>}
        {activeTab === "profile" && <div className="mt-6">
          <ProfileSettings onProfileUpdated={(updatedUser) =>
            setAddresses(updatedUser.addresses || [])
          } />
        </div>}
        {activeTab === "profile" && <div className="mt-6">
          <AccountSecurity />
        </div>}

        {activeTab === "addresses" && <section className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-5 w-5 text-blue-600" />
                Saved addresses
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Add a new address during checkout and choose it for each order.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddressForm((current) => !current)}
              className="shrink-0 text-sm font-semibold text-blue-600 hover:underline"
            >
              {showAddressForm ? "Cancel" : "+ Add address"}
            </button>
          </div>
          {showAddressForm && (
            <form
              onSubmit={saveAddress}
              className="mt-4 grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2"
            >
              <label className="text-sm text-gray-600">
                Address label
                <select
                  value={addressForm.type}
                  onChange={(event) =>
                    setAddressForm((current) => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-gray-900"
                >
                  <option>Home</option>
                  <option>Work</option>
                </select>
              </label>
              {[
                ["street", "Street address", 200],
                ["city", "City", 80],
                ["state", "State", 80],
                ["pincode", "PIN / postal code", 12],
              ].map(([field, label, maxLength]) => (
                <label key={field} className="text-sm text-gray-600">
                  {label}
                  <input
                    required
                    maxLength={maxLength}
                    value={addressForm[field]}
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-gray-900"
                  />
                </label>
              ))}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingAddress ? "Saving..." : "Save address"}
                </button>
              </div>
            </form>
          )}
          {addressError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {addressError}
            </p>
          )}
          {addresses.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {addresses.map((address) => (
                <article
                  key={address._id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {address.type}
                      </span>
                      {address.isDefault && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-5 text-gray-600">
                      {address.street}, {address.city}, {address.state},{" "}
                      {address.pincode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAddress(address._id)}
                    aria-label={`Delete ${address.type} address`}
                    title="Delete address"
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            !addressError && (
              <p className="mt-4 text-sm text-gray-500">
                No saved addresses yet. Add one during checkout.
              </p>
            )
          )}
        </section>}

        {activeTab === "wishlist" && <section id="wishlist" className="mt-6 rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Heart className="h-5 w-5 text-rose-500" />
                My wishlist
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Products you saved for later.
              </p>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              {wishlistPagination.total} saved
            </span>
          </div>
          {wishlistError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {wishlistError}
            </p>
          )}
          {wishlistLoading ? (
            <p className="py-6 text-sm text-gray-500">Loading wishlist...</p>
          ) : wishlist.length ? (
            <div className="divide-y">
              {wishlist.map((product) => (
                <article
                  key={product._id}
                  className="flex items-center gap-4 py-4"
                >
                  <Link to={`/product/${product._id}`} className="shrink-0">
                    <img
                      src={product.images?.[0]}
                      alt=""
                      className="h-16 w-16 rounded-lg bg-gray-100 object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${product._id}`}
                      className="font-semibold text-gray-900 hover:text-blue-600"
                    >
                      {product.title}
                    </Link>
                    <p className="mt-1 text-sm font-bold text-gray-700">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWishlistItem(product)}
                    aria-label={`Remove ${product.title} from wishlist`}
                    className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              Your wishlist is empty. Save products from their product pages.
            </p>
          )}
          <ListPagination
            page={wishlistPagination.page}
            totalPages={wishlistPagination.totalPages}
            total={wishlistPagination.total}
            label="wishlist items"
            onPageChange={(page) =>
              setWishlistPagination((current) => ({ ...current, page }))
            }
          />
        </section>}

        {activeTab === "orders" && <section className="bg-white border rounded-xl p-5 mt-6">
          <h2 className="font-bold text-lg mb-4">Your orders</h2>
          {error ? (
            <p role="alert" className="text-sm text-red-600">{error}</p>
          ) : loading ? (
            <p className="text-sm text-gray-500">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-gray-500">
              You have no orders yet. <Link to="/category" className="text-blue-600">Start shopping</Link>
            </p>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <article key={order._id} className="py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold">Order #{order._id.slice(-8)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{order.totalAmount.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-gray-500">
                        {order.orderStatus} · Payment {order.paymentInfo?.status}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-gray-600">
                    {order.items.map((item) => (
                      <li key={item._id || `${item.product}-${item.title}`}>
                        {item.quantity} × {item.title}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
