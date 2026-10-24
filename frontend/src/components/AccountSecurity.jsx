import { useState } from "react";
import api from "../api/client";

export default function AccountSecurity() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    if (form.newPassword.length < 8) {
      setStatus({
        type: "error",
        message: "New password must be at least 8 characters long.",
      });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (data.token) localStorage.setItem("shopmart_token", data.token);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setStatus({ type: "success", message: data.message });
    } catch (requestError) {
      setStatus({
        type: "error",
        message:
          requestError.response?.data?.message ||
          "Unable to update your password. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Password & security</h2>
        <p className="mt-1 text-sm text-gray-500">
          Change the password for your SHOPMART account.
        </p>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          ["currentPassword", "Current password", "current-password"],
          ["newPassword", "New password", "new-password"],
          ["confirmPassword", "Confirm new password", "new-password"],
        ].map(([field, label, autoComplete]) => (
          <label key={field} className="text-sm font-medium text-gray-700">
            {label}
            <input
              required
              type="password"
              autoComplete={autoComplete}
              minLength={field === "currentPassword" ? undefined : 8}
              value={form[field]}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            />
          </label>
        ))}
        <div className="sm:col-span-3">
          {status.message && (
            <p
              role={status.type === "error" ? "alert" : "status"}
              className={`mb-3 text-sm ${
                status.type === "error" ? "text-red-700" : "text-green-700"
              }`}
            >
              {status.message}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Updating..." : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}
