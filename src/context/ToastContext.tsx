import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { sound } from '../utils/sound';
import { CheckCircle2 } from 'lucide-react';

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
  isSaleToast?: boolean;
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
    ({ type, title, message, action, duration = 3000, isSaleToast = false }: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID();
      const newToast: ToastMessage = { id, type, title, message, action, duration, isSaleToast };

      setToasts((prev) => {
        // If this is a fast sale toast, replace any existing sale toast so they overlap in the exact same spot!
        if (isSaleToast) {
          prev.forEach((t) => {
            if (t.isSaleToast && timersRef.current.has(t.id)) {
              clearTimeout(timersRef.current.get(t.id));
              timersRef.current.delete(t.id);
            }
          });
          const filtered = prev.filter((t) => !t.isSaleToast);
          return [...filtered, newToast];
        }
        // General toast: keep max 2
        return [...prev.slice(-1), newToast];
      });

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
        duration: 3000, // Exactly 3 seconds as requested
        isSaleToast: true,
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
      {/* Toast Overlay Container - Slim, single line floating pill right above bottom nav */}
      <div className="fixed bottom-16 sm:bottom-20 left-0 right-0 z-50 flex flex-col items-center px-3 pointer-events-none space-y-1.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between w-full max-w-sm py-2 px-3.5 rounded-full shadow-lg border text-xs transition-all duration-200 transform animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'success'
                ? 'bg-emerald-900/95 text-white border-emerald-600/80 shadow-emerald-950/30'
                : t.type === 'error'
                ? 'bg-rose-900/95 text-white border-rose-600/80 shadow-rose-950/30'
                : t.type === 'warning'
                ? 'bg-amber-900/95 text-white border-amber-600/80 shadow-amber-950/30'
                : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/30'
            }`}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0 mr-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="font-semibold truncate">{t.title}</div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    removeToast(t.id);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 transition-all shadow-xs"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(t.id)}
                className="text-white/60 hover:text-white p-1 rounded-full leading-none text-xs ml-1"
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
