"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white dark:bg-erobo-bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-erobo-ink dark:text-white mb-2">{title}</h3>
        <p className="text-erobo-ink-soft dark:text-slate-300 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-erobo-purple/15 dark:border-white/10 hover:bg-erobo-purple/10 dark:hover:bg-white/10 text-erobo-ink dark:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-erobo-purple text-white hover:bg-erobo-purple-dark transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
