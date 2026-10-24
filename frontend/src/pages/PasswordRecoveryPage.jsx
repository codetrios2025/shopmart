import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/client";

export default function PasswordRecoveryPage({ reset = false }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    if (reset && password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = reset
        ? await api.post("/auth/reset-password", { token, password })
        : await api.post("/auth/forgot-password", { email });
      setStatus({ type: "success", message: data.message });
      if (reset) {
        setPassword("");
        setConfirmPassword("");
      }
    } catch (requestError) {
      setStatus({
        type: "error",
        message:
          requestError.response?.data?.message ||
          "Unable to process this request. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <Link to="/" className="text-2xl font-black text-blue-600">
          SHOPMART
        </Link>
        <h1 className="mt-6 text-xl font-bold text-gray-900">
          {reset ? "Choose a new password" : "Forgot your password?"}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {reset
            ? "Choose a new password with at least 8 characters."
            : "Enter your account email and we’ll send a reset link if an account matches."}
        </p>
        {reset && !token ? (
          <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            This password reset link is missing or invalid. Request a new one.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {reset ? (
              <>
                <label className="block text-sm font-medium text-gray-700">
                  New password
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Confirm new password
                  <input
                    required
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
              </>
            ) : (
              <label className="block text-sm font-medium text-gray-700">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            )}
            {status.message && (
              <p
                role={status.type === "error" ? "alert" : "status"}
                className={`text-sm ${
                  status.type === "error" ? "text-red-700" : "text-green-700"
                }`}
              >
                {status.message}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting
                ? "Please wait..."
                : reset
                  ? "Reset password"
                  : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="font-semibold text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
