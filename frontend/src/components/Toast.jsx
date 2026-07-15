import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const VARIANT_STYLES = {
  success: 'bg-running text-white',
  error: 'bg-stopped text-white',
  info: 'bg-info text-white'
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, variant = 'success', duration = 3000) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto shadow-lg rounded-md px-4 py-2.5 text-sm font-medium min-w-[220px] animate-[fadein_0.15s_ease-out] ${VARIANT_STYLES[t.variant] || VARIANT_STYLES.info}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
