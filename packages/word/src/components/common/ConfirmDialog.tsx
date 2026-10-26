import { useEffect } from 'react';
import { useI18n } from '@eflink-tech/office-kit';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 通用二次确认弹窗 */
export function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const confirmLabel = confirmText ?? t('action.confirm');
  const cancelLabel = cancelText ?? t('action.cancel');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-[420px] rounded-md border border-[#e7e9eb] bg-white p-5 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[15px] font-medium text-[#1f2329]">{title}</div>
        <div className="mb-4 text-[13px] leading-5 text-[#646a73] break-words">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#e7e9eb] px-3 py-1.5 text-xs text-[#51565f] hover:bg-[#f2f3f4]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
