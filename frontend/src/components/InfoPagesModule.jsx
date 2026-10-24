import { useEffect, useState } from "react";
import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api/client";

const emptySection = () => ({ title: "", body: "", linkLabel: "", linkTo: "" });

export default function InfoPagesModule() {
  const [pages, setPages] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPages = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/info-pages");
      setPages(data);
      setSelectedSlug((current) =>
        data.some((page) => page.slug === current) ? current : data[0]?.slug || "",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to load information pages.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api
      .get("/admin/info-pages")
      .then(({ data }) => {
        if (active) {
          setPages(data);
          setSelectedSlug(data[0]?.slug || "");
          setLoading(false);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load information pages.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const page = pages.find((item) => item.slug === selectedSlug);
  const updatePage = (updates) => {
    setPages((current) =>
      current.map((item) =>
        item.slug === selectedSlug ? { ...item, ...updates } : item,
      ),
    );
    setNotice("");
  };

  const savePage = async (event) => {
    event.preventDefault();
    if (!page) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.put(`/admin/info-pages/${page.slug}`, {
        title: page.title,
        intro: page.intro,
        sections: page.sections,
      });
      setPages((current) =>
        current.map((item) => (item.slug === data.slug ? data : item)),
      );
      setNotice("Page content saved and published.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to save page content.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gradient-to-r from-slate-950 to-indigo-950 px-6 py-6 text-white sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
          Storefront content
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Information pages</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Manage the copy and section links shown on your customer-care and company pages.
            </p>
          </div>
          {page && (
            <Link
              to={page.slug === "track-order" ? "/track-order" : `/info/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Preview page <ExternalLink size={15} />
            </Link>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-8">
        {error && (
          <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            {notice}
          </p>
        )}
        {loading ? (
          <p className="py-12 text-center text-sm text-gray-500">Loading page content…</p>
        ) : page ? (
          <form onSubmit={savePage} className="space-y-6">
            <div className="grid gap-5 md:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
              <label className="block text-sm font-semibold text-gray-700">
                Page
                <select
                  value={selectedSlug}
                  onChange={(event) => {
                    setSelectedSlug(event.target.value);
                    setNotice("");
                    setError("");
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {pages.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs font-normal text-gray-500">
                  URL: {page.slug === "track-order" ? "/track-order" : `/info/${page.slug}`}
                </span>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Page title
                <input
                  required
                  maxLength={120}
                  value={page.title}
                  onChange={(event) => updatePage({ title: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <label className="block text-sm font-semibold text-gray-700">
              Introduction
              <textarea
                required
                maxLength={1000}
                rows={3}
                value={page.intro}
                onChange={(event) => updatePage({ intro: event.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-3 font-normal leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Content sections</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Add up to 30 sections. Optional links must point to a path within your store.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={page.sections.length >= 30}
                  onClick={() => updatePage({ sections: [...page.sections, emptySection()] })}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                >
                  <Plus size={16} /> Add section
                </button>
              </div>
              {page.sections.map((section, index) => (
                <fieldset
                  key={`${page.slug}-${index}`}
                  className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <legend className="text-sm font-bold text-gray-800">
                      Section {index + 1}
                    </legend>
                    <button
                      type="button"
                      aria-label={`Remove section ${index + 1}`}
                      onClick={() =>
                        updatePage({
                          sections: page.sections.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      className="rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <label className="block text-sm font-medium text-gray-700">
                    Heading
                    <input
                      required
                      maxLength={120}
                      value={section.title}
                      onChange={(event) => {
                        const sections = [...page.sections];
                        sections[index] = { ...section, title: event.target.value };
                        updatePage({ sections });
                      }}
                      className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    Content
                    <textarea
                      required
                      maxLength={5000}
                      rows={4}
                      value={section.body}
                      onChange={(event) => {
                        const sections = [...page.sections];
                        sections[index] = { ...section, body: event.target.value };
                        updatePage({ sections });
                      }}
                      className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 leading-6 outline-none focus:border-blue-500"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Link label <span className="font-normal text-gray-400">· optional</span>
                      <input
                        maxLength={80}
                        value={section.linkLabel}
                        onChange={(event) => {
                          const sections = [...page.sections];
                          sections[index] = { ...section, linkLabel: event.target.value };
                          updatePage({ sections });
                        }}
                        placeholder="Track an order"
                        className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-sm font-medium text-gray-700">
                      Internal URL <span className="font-normal text-gray-400">· optional</span>
                      <input
                        maxLength={200}
                        value={section.linkTo}
                        onChange={(event) => {
                          const sections = [...page.sections];
                          sections[index] = { ...section, linkTo: event.target.value };
                          updatePage({ sections });
                        }}
                        placeholder="/track-order"
                        className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
              {!page.sections.length && (
                <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  No content sections yet. Use “Add section” to add one.
                </p>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-5">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
              >
                <Save size={17} /> {saving ? "Saving…" : "Save and publish"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={loadPages}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}
