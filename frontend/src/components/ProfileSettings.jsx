import { useEffect, useRef, useState } from "react";
import { Camera, UserRound } from "lucide-react";
import api, { resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

const emptyProfile = {
  name: "",
  email: "",
  phone: "",
  profileImage: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
};

export default function ProfileSettings({ onProfileUpdated }) {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const imagePreviewUrl = useRef("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    let active = true;
    api
      .get("/auth/profile")
      .then(({ data }) => {
        if (!active) return;
        const address =
          data.addresses?.find((item) => item.isDefault) ||
          data.addresses?.[0] ||
          {};
        setProfile({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          profileImage: data.profileImage || "",
          street: address.street || "",
          city: address.city || "",
          state: address.state || "",
          pincode: address.pincode || "",
        });
        updateUser(data);
      })
      .catch((error) => {
        if (active) {
          setStatus({
            type: "error",
            message:
              error.response?.data?.message || "Unable to load your profile.",
          });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [updateUser]);

  useEffect(
    () => () => {
      if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current);
    },
    [],
  );

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: "", message: "" });
    try {
      const payload = new FormData();
      payload.append("name", profile.name);
      payload.append("phone", profile.phone);
      for (const field of ["street", "city", "state", "pincode"]) {
        payload.append(field, profile[field]);
      }
      if (imageFile) payload.append("profileImage", imageFile);
      const { data } = await api.put("/auth/profile", payload);
      updateUser(data.user);
      onProfileUpdated?.(data.user);
      setProfile((current) => ({
        ...current,
        name: data.user.name,
        phone: data.user.phone || "",
        profileImage: data.user.profileImage || "",
      }));
      if (imagePreviewUrl.current) {
        URL.revokeObjectURL(imagePreviewUrl.current);
        imagePreviewUrl.current = "";
      }
      setImagePreview("");
      setImageFile(null);
      setStatus({ type: "success", message: data.message });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error.response?.data?.message ||
          "Unable to update your profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const displayedImage = imagePreview || resolveMediaUrl(profile.profileImage);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Personal profile</h2>
        <p className="mt-1 text-sm text-gray-500">
          Update your profile photo, contact number, and primary address.
        </p>
      </div>
      {loading ? (
        <p className="mt-5 text-sm text-gray-500">Loading profile...</p>
      ) : (
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-gray-50 text-gray-400">
              {displayedImage ? (
                <img
                  src={displayedImage}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound className="h-9 w-9" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <Camera className="h-4 w-4" />
              Choose photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setStatus({
                      type: "error",
                      message: "Profile image must be 2 MB or smaller.",
                    });
                    event.target.value = "";
                    return;
                  }
                  if (imagePreviewUrl.current) {
                    URL.revokeObjectURL(imagePreviewUrl.current);
                  }
                  imagePreviewUrl.current = URL.createObjectURL(file);
                  setImagePreview(imagePreviewUrl.current);
                  setImageFile(file);
                  setStatus({ type: "", message: "" });
                }}
              />
            </label>
            <span className="text-xs text-gray-500">
              JPG, PNG, WebP, or GIF · up to 2 MB
            </span>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Full name
            <input
              required
              maxLength={80}
              value={profile.name}
              onChange={(event) =>
                setProfile((current) => ({ ...current, name: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Email
            <input
              readOnly
              value={profile.email}
              className="mt-1 w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">
            Mobile number
            <input
              type="tel"
              maxLength={24}
              autoComplete="tel"
              value={profile.phone}
              onChange={(event) =>
                setProfile((current) => ({ ...current, phone: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800">
              Primary address
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Leave all address fields blank to keep your saved addresses unchanged.
            </p>
          </div>
          {[
            ["street", "Street address", 200],
            ["city", "City", 80],
            ["state", "State", 80],
            ["pincode", "PIN / postal code", 12],
          ].map(([field, label, maxLength]) => (
            <label key={field} className="text-sm font-medium text-gray-700">
              {label}
              <input
                maxLength={maxLength}
                autoComplete={
                  field === "street"
                    ? "street-address"
                    : field === "city"
                      ? "address-level2"
                      : field === "state"
                        ? "address-level1"
                        : "postal-code"
                }
                value={profile[field]}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            {status.message && (
              <p
                role={status.type === "error" ? "alert" : "status"}
                className={`mb-3 text-sm ${
                  status.type === "error" ? "text-red-700" : "text-emerald-700"
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
              {saving ? "Saving profile..." : "Save profile"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
