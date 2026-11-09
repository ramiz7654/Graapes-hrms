import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Centered confirmation popup, same look as the Logout confirmation.
 * Use the hook so call sites stay a one-liner:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: 'Delete holiday', message: 'Are you sure?', confirmLabel: 'Yes, Delete', danger: true }))) return;
 *   ...
 *   return (<div>{...}{confirmDialog}</div>);
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <h2 id="confirm-dialog-title" className="text-lg font-bold">{title}</h2>
        {message && <p className="mt-2 whitespace-pre-line text-sm text-muted">{message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">{cancelLabel}</button>
          <button type="button" autoFocus onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${danger ? 'bg-danger' : 'bg-accent'}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function useConfirm() {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((next) => new Promise((resolve) => {
    resolver.current = resolve;
    setOptions(next);
  }), []);

  const close = useCallback((value) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />
  ) : null;

  return { confirm, confirmDialog };
}
