import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 3000);
  }, [dismiss]);

  const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message)
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[320px]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const BORDER_COLOR = {
  success: 'border-l-running',
  error: 'border-l-stopped',
  info: 'border-l-accent'
};

function ToastItem({ toast, onDismiss }) {
  return (
    <div
      className="animate-toastIn bg-surface3 border border-hairline-strong rounded-card px-4 py-3 text-[13px] text-text-primary cursor-pointer border-l-2"
      style={{ borderLeftWidth: '2px' }}
      onClick={onDismiss}
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
        toast.type === 'success' ? 'bg-running' : toast.type === 'error' ? 'bg-stopped' : 'bg-accent'
      }`} />
      {toast.message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
