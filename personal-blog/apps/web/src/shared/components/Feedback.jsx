import { Check, X } from "@phosphor-icons/react";
import { useEffect } from "react";

export function StatusBanner({ children, message, title, tone = "error" }) {
  if (!message) return null;
  return (
    <div className={`status-banner is-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {children}
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div aria-live="polite" className="toast" role="status">
      <Check size={18} weight="bold" />
      <span>{message}</span>
    </div>
  );
}

export function Modal({ children, description, onClose, open, title }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-layer">
      <button aria-label="关闭对话框" className="modal-scrim" onClick={onClose} type="button" />
      <section aria-modal="true" className="modal-dialog" role="dialog">
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
