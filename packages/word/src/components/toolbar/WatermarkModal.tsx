import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@eflink-tech/office-kit';

interface WatermarkModalProps {
  initialValue: string | null;
  onSubmit: (text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

/** 水印设置弹窗：替代原生 prompt()，与整体 React 受控 UI 风格一致 */
export function WatermarkModal({ initialValue, onSubmit, onRemove, onClose }: WatermarkModalProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    } else {
      onRemove();
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('word.watermark.title')}
        tabIndex={-1}
        className="w-[320px] rounded-md border border-[#e7e9eb] bg-white p-4 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[14px] font-medium text-[#1f2329]">{t('word.watermark.title')}</span>
          <button
            type="button"
            onClick={onClose}
            title={t('action.close')}
            aria-label={t('action.close')}
            className="flex h-7 w-7 items-center justify-center rounded-[2px] text-[#51565f] hover:bg-[#f2f3f4]"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('word.watermark.placeholder')}
          className="mb-3 h-8 w-full rounded border border-slate-200 px-2 text-[13px] text-slate-700 outline-none focus:border-blue-400"
        />

        <div className="flex justify-end gap-2">
          {initialValue && (
            <button
              type="button"
              onClick={() => { onRemove(); onClose(); }}
              className="rounded border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              {t('word.insert.watermarkRemove')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
          >
            {t('action.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
