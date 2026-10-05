'use client';

export type ToastState = { kind: 'success' | 'error' | 'info'; message: string } | null;

export default function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role="status" aria-live="polite">
      <span className="toast-symbol" aria-hidden="true">
        {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}
      </span>
      <span>{toast.message}</span>
      <button type="button" aria-label="Dismiss message" onClick={onClose}>×</button>
    </div>
  );
}
