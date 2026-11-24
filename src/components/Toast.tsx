import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';
import type { ToastType } from '../types';

type ShowToast = (msg: string, type?: ToastType) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
}

/** 全局轻提示：任意组件调用 useToast()(消息, 类型) */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const show = useCallback<ShowToast>((msg, type = '') => {
    window.clearTimeout(timerRef.current);
    setToast({ id: Date.now(), msg, type });
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-none fixed bottom-8 left-1/2 z-[200] max-w-[90vw] -translate-x-1/2 animate-[toastIn_.28s_cubic-bezier(.22,1,.36,1)] rounded-lg bg-ink px-5 py-[11px] text-[13px] font-medium text-white shadow-[0_12px_32px_-12px_rgba(10,37,64,.5)]',
            toast.type === 'error' && 'bg-[#8f332a]',
          )}
        >
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}
