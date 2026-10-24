import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleScriptUrl = "https://accounts.google.com/gsi/client";

export default function AuthPage({ register = false }) {
  const { login, googleLogin, registerUser } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const googleHandlerRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "customer",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigateToAccount = (user, welcomeEmailSent) => {
    const destination =
      user.role === "admin"
        ? "/admin"
        : user.role === "seller"
          ? "/seller"
          : "/customer";
    navigate(destination, {
      state:
        register && !welcomeEmailSent
          ? {
              accountNotice:
                "Your account was created, but the welcome email could not be sent. The store administrator may need to configure email delivery.",
            }
          : undefined,
    });
  };

  useEffect(() => {
    googleHandlerRef.current = async (credential) => {
      setError("");
      setSubmitting(true);
      try {
        const user = await googleLogin(credential);
        const destination =
          user.role === "admin"
            ? "/admin"
            : user.role === "seller"
              ? "/seller"
              : "/customer";
        navigate(destination);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Google sign-in could not be completed. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    };
    return () => {
      googleHandlerRef.current = null;
    };
  }, [googleLogin, navigate]);

  useEffect(() => {
    if (!googleClientId) return undefined;
    let isActive = true;
    let script = document.querySelector(`script[src="${googleScriptUrl}"]`);
    const renderGoogleButton = () => {
      const googleIdentity = window.google?.accounts?.id;
      if (!isActive || !googleIdentity || !googleButtonRef.current) return;
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (response.credential) {
            googleHandlerRef.current?.(response.credential);
          }
        },
      });
      googleIdentity.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: Math.min(360, googleButtonRef.current.clientWidth || 320),
      });
    };
    const onScriptError = () => {
      if (isActive) setError("Google sign-in is currently unavailable.");
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", onScriptError);
    } else {
      script = document.createElement("script");
      script.src = googleScriptUrl;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", onScriptError);
      document.head.appendChild(script);
    }

    return () => {
      isActive = false;
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", onScriptError);
    };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const user = register
        ? await registerUser(form)
        : await login(form.email, form.password);
      if (register && user.role === "seller" && !user.token) {
        setSuccess(
          `${user.message} Your seller code is ${user.sellerCode}. Save it for your records.`,
        );
        setForm((current) => ({ ...current, password: "" }));
        return;
      }
      navigateToAccount(user, user.welcomeEmailSent);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not connect to SHOPMART. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white border rounded-2xl shadow-sm p-8">
        <Link to="/" className="text-2xl font-black text-blue-600">
          SHOPMART
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-6">
          {register ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {register
            ? "Join SHOPMART to start shopping or selling."
            : "Sign in to continue to your account."}
        </p>
        <form onSubmit={submit} className="space-y-4 mt-6">
          {register && (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Full name
                <input
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Account type
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value })
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 font-normal bg-white"
                >
                  <option value="customer">Customer</option>
                  <option value="seller">Seller</option>
                </select>
              </label>
            </>
          )}
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Password
            <input
              required
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : undefined}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              {success}
            </p>
          )}
          {!register && (
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-blue-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting
              ? "Please wait..."
              : register
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          <span>OR</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        {googleClientId ? (
          <div
            ref={googleButtonRef}
            className="flex min-h-10 justify-center"
            aria-label="Continue with Google"
          />
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={() =>
                setError(
                  "Google sign-in needs setup first. Add the same OAuth client ID to VITE_GOOGLE_CLIENT_ID in frontend/.env and GOOGLE_CLIENT_ID in backend/.env, then restart both apps.",
                )
              }
              className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <span className="font-bold text-blue-600">G</span>
              Continue with Google
            </button>
            <p className="mt-2 text-xs text-gray-400">
              Google sign-in requires OAuth client configuration.
            </p>
          </div>
        )}
        {register && (
          <p className="mt-2 text-center text-xs text-gray-400">
            Google sign-up creates a customer account.
          </p>
        )}
        <p className="text-sm text-center text-gray-600 mt-6">
          {register ? "Already have an account?" : "New to SHOPMART?"}{" "}
          <Link
            to={register ? "/login" : "/register"}
            className="font-semibold text-blue-600 hover:underline"
          >
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
    </main>
  );
}
