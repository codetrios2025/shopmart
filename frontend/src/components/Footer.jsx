import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, ShoppingBag } from "lucide-react";
import api from "../api/client";

const categoryLinks = ["Fashion", "Electronics", "Home & Kitchen", "Beauty", "Sports"];

const serviceLinks = [
  ["Contact Us", "/info/contact"],
  ["Track Order", "/track-order"],
  ["Returns & Refunds", "/info/returns-refunds"],
  ["Shipping Policy", "/info/shipping-policy"],
  ["FAQ", "/info/faq"],
];

const companyLinks = [
  ["About Us", "/info/about"],
  ["Careers", "/info/careers"],
  ["Terms & Conditions", "/info/terms-conditions"],
  ["Privacy Policy", "/info/privacy-policy"],
];

function FooterLinks({ title, links }) {
  return (
    <div>
      <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-white">
        {title}
      </h3>
      <ul className="space-y-3 text-sm text-slate-400">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link
              to={to}
              className="transition-colors duration-200 hover:text-white focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const [email, setEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState({
    type: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const subscribe = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNewsletterStatus({ type: "", message: "" });
    try {
      const { data } = await api.post("/newsletter/subscribe", { email });
      setNewsletterStatus({ type: "success", message: data.message });
      setEmail("");
    } catch (requestError) {
      setNewsletterStatus({
        type: "error",
        message:
          requestError.response?.data?.message ||
          "Unable to subscribe right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const categories = categoryLinks.map((name) => [
    name,
    `/category?category=${encodeURIComponent(name)}`,
  ]);

  return (
    <footer className="border-t border-slate-800 bg-[#0B1528] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-14 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-x-10 gap-y-12 border-b border-white/10 pb-12 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_1fr_0.9fr_1.4fr] lg:gap-x-12">
          <div>
            <Link
              to="/"
              className="mb-5 inline-flex items-center gap-2.5 text-lg font-extrabold tracking-wide text-white transition-opacity hover:opacity-80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/40">
                <ShoppingBag size={18} strokeWidth={2.2} aria-hidden="true" />
              </span>
              SHOPMART
            </Link>
            <p className="max-w-xs text-sm leading-6 text-slate-400">
              India&apos;s most loved online shopping destination for fashion,
              electronics, and lifestyle.
            </p>
          </div>

          <FooterLinks title="Explore" links={categories} />
          <FooterLinks title="Customer care" links={serviceLinks} />
          <FooterLinks title="Company" links={companyLinks} />

          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white">
              Get the good stuff
            </h3>
            <p className="mb-5 text-sm leading-6 text-slate-400">
              New arrivals, special offers, and a little shopping inspiration.
            </p>
            <form onSubmit={subscribe} className="flex gap-2">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <div className="relative min-w-0 flex-1">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  id="footer-newsletter-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Your email address"
                  className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.06] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                aria-label={submitting ? "Subscribing" : "Subscribe"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1528] disabled:cursor-wait disabled:opacity-60"
              >
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className={submitting ? "animate-pulse" : ""}
                />
              </button>
            </form>
            {newsletterStatus.message && (
              <p
                role={newsletterStatus.type === "error" ? "alert" : "status"}
                className={`mt-3 text-xs leading-5 ${
                  newsletterStatus.type === "error"
                    ? "text-red-300"
                    : "text-green-300"
                }`}
              >
                {newsletterStatus.message}
              </p>
            )}
            <div className="mt-6">
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                We accept
              </p>
              <div className="flex flex-wrap gap-2">
                {["VISA", "Mastercard", "UPI"].map((method) => (
                  <span
                    key={method}
                    className="rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-slate-200"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-6 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} SHOPMART. All rights reserved.
          </p>
          <p className="text-xs text-slate-500">
            Made for the way you shop.
          </p>
        </div>
      </div>
    </footer>
  );
}
