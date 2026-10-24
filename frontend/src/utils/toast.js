export const showToast = (message, type = "success") => {
  if (typeof window === "undefined" || !message) return;
  window.dispatchEvent(
    new CustomEvent("shopmart:toast", {
      detail: { message: String(message), type },
    }),
  );
};
