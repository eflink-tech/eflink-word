import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface RenameDialogProps {
  currentName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

/** 修改文档名称弹窗 */
export function RenameDialog({ currentName, onConfirm, onCancel }: RenameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== currentName) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="修改文档名称"
        tabIndex={-1}
        className="w-[380px] rounded-md border border-[#e7e9eb] bg-white p-5 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-medium text-[#1f2329]">修改文档名称</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭"
            className="flex h-7 w-7 items-center justify-center rounded-[2px] text-[#51565f] hover:bg-[#f2f3f4]"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="请输入文档名称"
          className="mb-4 h-9 w-full rounded border border-[#e7e9eb] px-3 text-[14px] text-[#1f2329] outline-none focus:border-blue-400"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#e7e9eb] px-3 py-1.5 text-xs text-[#51565f] hover:bg-[#f2f3f4]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
