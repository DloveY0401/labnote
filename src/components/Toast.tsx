import { useState, useCallback, useEffect } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

export function ToastContainer({ toasts, removeToast }: {
  toasts: ToastItem[];
  removeToast: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onDone={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  const bg = item.type === 'success' ? 'bg-green-600' : 'bg-red-600';

  return (
    <div className={`${bg} text-white px-lg py-sm rounded-lg shadow-lg text-body animate-fade-in pointer-events-auto`}>
      {item.message}
    </div>
  );
}
