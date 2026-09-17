import { useEffect } from 'react';

interface ErrorDialogProps {
  title: string;
  message: string;
  onClose: () => void;
}

/** 操作失败提示弹窗（docx 导入导出等场景） */
export function ErrorDialog({ title, message, onClose }: ErrorDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
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
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
