import { useEffect, useRef, useState } from 'react';
function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface LinkDialogProps {
  open: boolean;
  initialText: string;
  initialUrl: string;
  onClose: () => void;
  onSubmit: (text: string, url: string) => void;
  onUnset?: () => void;
  showUnset?: boolean;
}

export function LinkDialog({
  open,
  initialText,
  initialUrl,
  onClose,
  onSubmit,
  onUnset,
  showUnset = false,
}: LinkDialogProps) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [urlError, setUrlError] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setUrl(initialUrl);
      setUrlError(false);
      requestAnimationFrame(() => urlInputRef.current?.focus());
    }
  }, [open, initialText, initialUrl]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!isValidHttpUrl(url)) {
      setUrlError(true);
      return;
    }
    onSubmit(text, url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="链接"
        className="w-[320px] rounded-md border border-[#e7e9eb] bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-[14px] font-medium text-[#1f2329]">链接</div>

        <label className="mb-3 block">
          <span className="mb-1 block text-[12px] text-[#8f959e]">显示文本</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded border border-[#e7e9eb] px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff]"
            placeholder="可选"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-[12px] text-[#8f959e]">URL</span>
          <input
            ref={urlInputRef}
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlError(false);
            }}
            className="w-full rounded border border-[#e7e9eb] px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff]"
            placeholder="https://"
          />
          {urlError && (
            <span className="mt-1 block text-[12px] text-[#d93025]">
              请输入有效的 http/https URL
            </span>
          )}
        </label>

        <div className="flex items-center justify-end gap-2">
          {showUnset && onUnset && (
            <button
              type="button"
              onClick={() => {
                onUnset();
                onClose();
              }}
              className="mr-auto rounded px-3 py-1.5 text-[13px] text-[#d93025] hover:bg-[#fde8e8]"
            >
              取消链接
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-[13px] text-[#41464f] hover:bg-[#f2f3f4]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-[#3370ff] px-3 py-1.5 text-[13px] text-white hover:bg-[#2860e1]"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
