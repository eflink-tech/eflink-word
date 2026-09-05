// 行距下拉（纯受控组件，由 Toolbar 连接 canvas-editor executeRowMargin）
import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { WordLineHeightIcon, WordCaretDown } from '../../components/icons/wordIcons';

interface LineHeightSelectProps {
  /** 当前行距倍数（对应 canvas-editor IRangeStyle.rowMargin） */
  value: number;
  /** 选择新行距时的回调 */
  onChange: (margin: number) => void;
}

// 与旧系统一致的可选行距
const LINE_HEIGHTS: number[] = [1, 1.25, 1.3, 1.5, 1.75, 2, 2.5, 3];

const DEFAULT_LINE_HEIGHT = 1.3;

/** 行间距下拉（对应旧系统 row-margin 菜单） */
export function LineHeightSelect({ value, onChange }: LineHeightSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = value ?? DEFAULT_LINE_HEIGHT;

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  const handleSelect = (margin: number) => {
    onChange(margin);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`行距（当前 ${current}）`}
        aria-label={`行距（当前 ${current}）`}
        className="mx-px flex h-6 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordLineHeightIcon className="h-[18px] w-[18px]" />
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[72px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {LINE_HEIGHTS.map((margin) => (
            <button
              key={margin}
              type="button"
              onClick={() => handleSelect(margin)}
              className={`block w-full px-3 py-1.5 text-center text-[13px] hover:bg-[#f2f3f4] ${
                margin === current ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
            >
              {margin}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
