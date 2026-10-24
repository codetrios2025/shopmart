import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const invalidForms = new WeakSet();
    const handleToast = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      const toast = {
        id,
        message: event.detail?.message || "Something went wrong.",
        type: icons[event.detail?.type] ? event.detail.type : "info",
      };
      setToasts((current) => [...current.slice(-3), toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, toast.type === "error" ? 7000 : 4500);
    };
    const handleInvalid = (event) => {
      const form = event.target?.form;
      if (form && invalidForms.has(form)) return;
      if (form) {
        invalidForms.add(form);
        window.setTimeout(() => invalidForms.delete(form), 0);
      }
      window.dispatchEvent(
        new CustomEvent("shopmart:toast", {
          detail: {
            message: "Please review the highlighted fields.",
            type: "error",
          },
        }),
      );
    };

    window.addEventListener("shopmart:toast", handleToast);
    document.addEventListener("invalid", handleInvalid, true);
    return () => {
      window.removeEventListener("shopmart:toast", handleToast);
      document.removeEventListener("invalid", handleInvalid, true);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        const colors =
          toast.type === "success"
            ? "border-emerald-200 bg-white text-emerald-800"
            : toast.type === "error"
              ? "border-red-200 bg-white text-red-800"
              : "border-blue-200 bg-white text-blue-800";
        return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg shadow-gray-900/10 ${colors}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-5">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() =>
                setToasts((current) =>
                  current.filter((item) => item.id !== toast.id),
                )
              }
              aria-label="Dismiss notification"
              className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
