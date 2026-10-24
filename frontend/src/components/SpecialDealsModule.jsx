import { useEffect, useState } from "react";
import { Clock3, Pencil, Plus, Trash2, Zap } from "lucide-react";
import api, { resolveMediaUrl } from "../api/client";

const toLocalDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const initialDealForm = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return {
    title: "",
    product: "",
    discountPercentage: "15",
    startsAt: toLocalDateTime(now),
    endsAt: toLocalDateTime(end),
  };
};

const getDealStatus = (deal) => {
  const now = Date.now();
  if (!deal.isActive) return "Paused";
  if (new Date(deal.startsAt).getTime() > now) return "Scheduled";
  if (new Date(deal.endsAt).getTime() <= now) return "Ended";
  return "Live";
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function SpecialDealsModule() {
  const [deals, setDeals] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialDealForm);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [dealsResponse, productsResponse] = await Promise.all([
        api.get("/admin/special-deals"),
        api.get("/admin/products", { params: { limit: 50, sort: "name-asc" } }),
      ]);
      if (
        !Array.isArray(dealsResponse.data) ||
        !Array.isArray(productsResponse.data?.products)
      ) {
        throw new Error("Special deals or product data could not be read.");
      }
      setDeals(dealsResponse.data);
      setProducts(productsResponse.data.products);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to load special deals.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingId("");
    setForm(initialDealForm());
    setError("");
  };

  const saveDeal = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        discountPercentage: Number(form.discountPercentage),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      if (editingId) {
        await api.put(`/admin/special-deals/${editingId}`, payload);
      } else {
        await api.post("/admin/special-deals", payload);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save this special deal.",
      );
    } finally {
      setSaving(false);
    }
  };

  const editDeal = (deal) => {
    setEditingId(deal._id);
    setForm({
      title: deal.title,
      product: deal.product?._id || "",
      discountPercentage: String(deal.discountPercentage),
      startsAt: toLocalDateTime(deal.startsAt),
      endsAt: toLocalDateTime(deal.endsAt),
    });
    setError("");
  };

  const toggleDeal = async (deal) => {
    setError("");
    try {
      const { data } = await api.put(`/admin/special-deals/${deal._id}/toggle`);
      setDeals((current) =>
        current.map((item) => (item._id === data._id ? data : item)),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to update this deal.",
      );
    }
  };

  const deleteDeal = async (deal) => {
    if (!window.confirm(`Delete the "${deal.title}" special deal?`)) return;
    setError("");
    try {
      await api.delete(`/admin/special-deals/${deal._id}`);
      setDeals((current) => current.filter((item) => item._id !== deal._id));
      if (editingId === deal._id) resetForm();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to delete this deal.",
      );
    }
  };

  const productHasDeal = (productId) =>
    deals.some(
      (deal) =>
        deal._id !== editingId &&
        String(deal.product?._id || deal.product) === String(productId) &&
        deal.isActive &&
        new Date(deal.endsAt) > new Date(form.startsAt) &&
        new Date(deal.startsAt) < new Date(form.endsAt),
    );

  return (
    <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.5fr)]">
      <form
        onSubmit={saveDeal}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {editingId ? "Edit special deal" : "Create a special deal"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Set a product discount and schedule when it appears on the store.
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Deal title
          <input
            required
            maxLength={80}
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Weekend special"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Product
          <select
            required
            value={form.product}
            onChange={(event) =>
              setForm((current) => ({ ...current, product: event.target.value }))
            }
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="">Choose a product</option>
            {products.map((product) => {
              const reserved = productHasDeal(product._id);
              return (
                <option
                  key={product._id}
                  value={product._id}
                  disabled={reserved}
                >
                  {product.title} · ₹{Number(product.price).toLocaleString("en-IN")}
                  {reserved ? " · already scheduled" : ""}
                </option>
              );
            })}
          </select>
          <span className="mt-1 block font-normal text-slate-500">
            Each product can have one active deal in a given time period.
          </span>
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Deal discount
          <div className="relative mt-1.5">
            <input
              required
              type="number"
              min="1"
              max="99"
              step="0.5"
              value={form.discountPercentage}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discountPercentage: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
              %
            </span>
          </div>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-700">
            Starts at
            <input
              required
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, startsAt: event.target.value }))
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Ends at
            <input
              required
              type="datetime-local"
              min={form.startsAt || undefined}
              value={form.endsAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, endsAt: event.target.value }))
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-normal text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? "Saving..." : editingId ? "Save changes" : "Create deal"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Deal schedule</h2>
            <p className="mt-1 text-xs text-slate-500">
              Scheduled discounts activate and expire automatically.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {deals.length} {deals.length === 1 ? "deal" : "deals"}
          </span>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading deals...</p>
        ) : deals.length ? (
          <div className="divide-y divide-slate-100">
            {deals.map((deal) => {
              const status = getDealStatus(deal);
              const product = deal.product;
              const dealPrice = product
                ? Number(
                    (
                      Number(product.price) *
                      (1 - Number(deal.discountPercentage) / 100)
                    ).toFixed(2),
                  )
                : 0;
              return (
                <article
                  key={deal._id}
                  className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  {product?.images?.[0] ? (
                    <img
                      src={resolveMediaUrl(product.images[0])}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Zap className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-900">
                        {deal.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          status === "Live"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "Scheduled"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {product?.title || "Product unavailable"} · Save{" "}
                      {deal.discountPercentage}%
                    </p>
                    {product && (
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        ₹{dealPrice.toLocaleString("en-IN")}{" "}
                        <span className="font-normal text-slate-400 line-through">
                          ₹{Number(product.price).toLocaleString("en-IN")}
                        </span>
                      </p>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock3 className="h-3 w-3" />
                      {formatDate(deal.startsAt)} — {formatDate(deal.endsAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleDeal(deal)}
                      className={`rounded-lg px-2.5 py-2 text-[10px] font-semibold ${
                        deal.isActive
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {deal.isActive ? "Active" : "Paused"}
                    </button>
                    <button
                      type="button"
                      onClick={() => editDeal(deal)}
                      aria-label={`Edit ${deal.title}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDeal(deal)}
                      aria-label={`Delete ${deal.title}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
            <Zap className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No special deals yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Create a scheduled discount to feature products on your homepage.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
