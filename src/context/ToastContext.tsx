import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { sound } from '../utils/sound';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => string;
  showSaleSuccess: (title: string, amount: string, onUndo?: () => void) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, any>>(new Map());

  const removeToast = useCallback((id: string) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, action, duration = 3500 }: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID();
      const newToast: ToastMessage = { id, type, title, message, action, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]); // keep max 4 toasts

      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  const showSaleSuccess = useCallback(
    (productName: string, amountText: string, onUndo?: () => void) => {
      sound.playSuccess();
      return showToast({
        type: 'success',
        title: `${productName} বিক্রি সম্পন্ন (${amountText})`,
        message: onUndo ? 'ভুল হলে বাতিল করতে "আনডু" চাপুন' : undefined,
        duration: 5000,
        action: onUndo
          ? {
              label: 'আনডু / Undo',
              onClick: () => {
                sound.playUndo();
                onUndo();
              }
            }
          : undefined
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, showSaleSuccess, removeToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center px-4 pointer-events-none space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between w-full max-w-md p-3.5 rounded-xl shadow-xl border text-sm transition-all duration-300 transform animate-in fade-in slide-in-from-bottom-3 ${
              t.type === 'success'
                ? 'bg-emerald-900/95 text-white border-emerald-700 shadow-emerald-950/20'
                : t.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-700 shadow-rose-950/20'
                : t.type === 'warning'
                ? 'bg-amber-900/95 text-white border-amber-700 shadow-amber-950/20'
                : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20'
            }`}
          >
            <div className="flex-1 mr-2 min-w-0">
              <div className="font-semibold truncate">{t.title}</div>
              {t.message && <div className="text-xs text-white/80 mt-0.5">{t.message}</div>}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-300 active:scale-95 transition-all shadow-sm"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="text-white/60 hover:text-white p-1 rounded-md"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
