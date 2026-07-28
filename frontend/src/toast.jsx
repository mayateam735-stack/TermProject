import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

const ToastContext = createContext(null);

/** useToast() → toast(message, type?)  where type is "success" | "error" | "info". */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return () => {};
  return ctx;
}

const ICONS = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, type = "success", ms = 2800) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, type }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
            <span className="toast-icon">{ICONS[t.type] ?? ICONS.info}</span>
            <span>{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
