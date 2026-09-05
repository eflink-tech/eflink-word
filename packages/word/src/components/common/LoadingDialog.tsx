interface LoadingDialogProps {
  message?: string;
}

/** 全屏 loading 遮罩，用于耗时操作（如 PDF 导出） */
export function LoadingDialog({ message = '正在处理，请稍候...' }: LoadingDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/30"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-3 rounded-md border border-[#e7e9eb] bg-white px-8 py-6 shadow-lg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[#e7e9eb] border-t-blue-500"
          aria-hidden="true"
        />
        <div className="text-[13px] text-[#51565f]">{message}</div>
      </div>
    </div>
  );
}
