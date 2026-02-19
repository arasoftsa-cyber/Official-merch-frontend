import React from 'react';
import { Modal } from './Modal';
import { cn } from './cn';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Back',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClass = danger
    ? 'bg-rose-500 text-white hover:bg-rose-400'
    : 'bg-indigo-500 text-white hover:bg-indigo-400';

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-slate-200">{message}</p>
      <div className="mt-4 flex justify-end gap-2 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="om-btn om-focus rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em]"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn('om-btn om-focus rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]', confirmClass)}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
