import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function TrackOrderPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageContent, setPageContent] = useState(null);
  const [pageContentError, setPageContentError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/info-pages/track-order")
      .then(({ data }) => {
        if (active) setPageContent(data);
      })
      .catch((requestError) => {
        if (active) {
          setPageContentError(
            requestError.response?.data?.message ||
              "Page information could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || user.role !== "customer") return;
    let active = true;
    api
      .get("/orders/my-orders")
      .then(({ data }) => {
        if (active) setOrders(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load your orders.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const matchingOrders = searched
    ? orders.filter((order) =>
        order._id.toLowerCase().includes(orderId.trim().toLowerCase()),
      )
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <Link to="/" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Back to SHOPMART
        </Link>
        <section className="mt-5 rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {pageContent?.title || "Track your order"}
          </h1>
          <p className="mt-2 text-gray-600">
            {pageContent?.intro ||
              "Sign in with the customer account used at checkout to see your order and payment status."}
          </p>
          {pageContentError && (
            <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              {pageContentError}
            </p>
          )}
          {!user ? (
            <Link
              to="/login"
              className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Sign in to view orders
            </Link>
          ) : user.role !== "customer" ? (
            <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              Order tracking is available from a customer account.
            </p>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearched(true);
                }}
                className="mt-6 flex flex-col gap-3 sm:flex-row"
              >
                <label className="sr-only" htmlFor="track-order-id">
                  Order ID
                </label>
                <input
                  id="track-order-id"
                  value={orderId}
                  onChange={(event) => {
                    setOrderId(event.target.value);
                    setSearched(false);
                  }}
                  placeholder="Enter an order ID (or part of it)"
                  className="min-w-0 flex-1 rounded-lg border px-4 py-3 text-sm text-gray-900"
                />
                <button
                  type="submit"
                  disabled={!orderId.trim() || loading}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Find order
                </button>
              </form>
              {error && (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              {loading ? (
                <p className="mt-6 text-sm text-gray-500">Loading your orders…</p>
              ) : searched ? (
                matchingOrders.length ? (
                  <div className="mt-6 space-y-4">
                    {matchingOrders.map((order) => (
                      <article
                        key={order._id}
                        className="rounded-xl border p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="font-bold text-gray-900">
                              Order #{order._id.slice(-8).toUpperCase()}
                            </h2>
                            <p className="mt-1 text-xs text-gray-500">
                              Placed{" "}
                              {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              ₹{Number(order.totalAmount).toLocaleString("en-IN")}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              {order.orderStatus} · Payment{" "}
                              {order.paymentInfo?.status || "Pending"}
                            </p>
                          </div>
                        </div>
                        <ul className="mt-4 divide-y text-sm text-gray-600">
                          {order.items.map((item) => (
                            <li
                              key={item._id || `${item.product}-${item.title}`}
                              className="flex items-center gap-3 py-2"
                            >
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt=""
                                  className="h-12 w-12 rounded-lg border object-cover"
                                />
                              )}
                              <span>
                                {item.quantity} × {item.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                    No order matching that ID was found in your account. Check
                    the ID and try again.
                  </p>
                )
              ) : (
                <p className="mt-6 text-sm text-gray-500">
                  {orders.length
                    ? `${orders.length} order(s) are available to track.`
                    : "You have no orders yet."}
                </p>
              )}
              <Link
                to="/customer"
                className="mt-6 inline-flex font-semibold text-blue-600 hover:underline"
              >
                View all orders →
              </Link>
            </>
          )}
          {pageContent?.sections?.length > 0 && (
            <div className="mt-8 grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-2">
              {pageContent.sections.map((section, index) => (
                <section
                  key={`${section.title}-${index}`}
                  className="rounded-xl bg-gray-50 p-4"
                >
                  <h2 className="font-semibold text-gray-900">{section.title}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                    {section.body}
                  </p>
                  {section.linkTo && section.linkLabel && (
                    <Link
                      to={section.linkTo}
                      className="mt-3 inline-flex font-semibold text-blue-600 hover:underline"
                    >
                      {section.linkLabel} →
                    </Link>
                  )}
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
