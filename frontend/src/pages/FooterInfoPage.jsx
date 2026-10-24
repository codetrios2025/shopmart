import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, LifeBuoy } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import api from "../api/client";

export default function FooterInfoPage() {
  const { slug } = useParams();
  const [result, setResult] = useState({
    slug,
    page: null,
    loading: true,
    error: "",
  });
  const loading = result.slug !== slug || result.loading;
  const page = result.slug === slug ? result.page : null;
  const error = result.slug === slug ? result.error : "";

  useEffect(() => {
    let active = true;
    api
      .get(`/info-pages/${slug}`)
      .then(({ data }) => {
        if (active) setResult({ slug, page: data, loading: false, error: "" });
      })
      .catch((requestError) => {
        if (active) {
          setResult({
            slug,
            page: null,
            loading: false,
            error:
              requestError.response?.status === 404
                ? "This SHOPMART page may have moved."
                : requestError.response?.data?.message ||
                    "Unable to load this page right now.",
          });
        }
      })
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={16} /> Back to SHOPMART
        </Link>

        {loading ? (
          <div className="mt-6 animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="h-56 bg-slate-200" />
            <div className="space-y-4 p-8">
              <div className="h-5 w-1/3 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-28 rounded-2xl bg-slate-100" />
            </div>
          </div>
        ) : page ? (
          <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
            <header className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-14">
              <div className="absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10" />
              <div className="absolute -right-2 -top-12 -z-10 h-52 w-52 rounded-full border border-white/10" />
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
                {slug === "faq" ? <BookOpenText size={16} /> : <LifeBuoy size={16} />}
                SHOPMART · {slug === "faq" ? "Help center" : "Customer information"}
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {page.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                {page.intro}
              </p>
            </header>

            <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-12 lg:p-12">
              <div className="space-y-4">
                {page.sections.map((section, index) => (
                  <section
                    key={`${section.title}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-sm sm:p-7"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold tracking-tight text-slate-900">
                          {section.title}
                        </h2>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                          {section.body}
                        </p>
                        {section.linkTo && section.linkLabel && (
                          <Link
                            to={section.linkTo}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3.5 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                          >
                            {section.linkLabel} <ArrowRight size={16} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </section>
                ))}
                {!page.sections.length && (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    More information will be available here soon.
                  </p>
                )}
              </div>

              <aside className="h-fit rounded-2xl bg-slate-50 p-5 sm:p-6 lg:sticky lg:top-24">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                  Need more help?
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">
                  We’re here for you
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Find answers or check the latest status of an order from your account.
                </p>
                <div className="mt-5 space-y-2">
                  <Link
                    to="/info/faq"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    Visit the FAQ <ArrowRight size={16} />
                  </Link>
                  <Link
                    to="/track-order"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                  >
                    Track an order <ArrowRight size={16} />
                  </Link>
                </div>
              </aside>
            </div>
          </article>
        ) : (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">
              {error.includes("moved") ? "Page not found" : "Page unavailable"}
            </h1>
            <p role="alert" className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              {error || "This SHOPMART page may have moved."}
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              Return to the home page <ArrowRight size={16} />
            </Link>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
