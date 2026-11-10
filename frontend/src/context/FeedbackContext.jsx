import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Button, Modal } from '../components/ui';

const FeedbackContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  info: <Info className="h-5 w-5 text-brand-500" />,
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog(typeof opts === 'string' ? { message: opts } : opts);
  }), []);

  const close = (value) => {
    resolver.current?.(value);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            {ICONS[t.type]}
            <p className="flex-1 text-sm text-slate-700">{t.message}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Modal open={!!dialog} onClose={() => close(false)} size="sm">
        {dialog && (
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${dialog.danger ? 'bg-red-100' : 'bg-brand-100'}`}>
              <AlertTriangle className={`h-6 w-6 ${dialog.danger ? 'text-red-600' : 'text-brand-600'}`} />
            </div>
            <h3 className="text-lg font-semibold">{dialog.title || 'Xác nhận'}</h3>
            <p className="mt-2 text-sm text-slate-600">{dialog.message}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={() => close(false)}>Hủy</Button>
              <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
                {dialog.confirmText || 'Đồng ý'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </FeedbackContext.Provider>
  );
}

export const useFeedback = () => useContext(FeedbackContext);
