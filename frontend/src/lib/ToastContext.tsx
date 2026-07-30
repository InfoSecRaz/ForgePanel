import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import type { ToastItem } from '../types';

interface ToastAPI {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: ToastItem['type'], message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 3000);
  }, [dismiss]);

  const toast: ToastAPI = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m)
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

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
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

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
