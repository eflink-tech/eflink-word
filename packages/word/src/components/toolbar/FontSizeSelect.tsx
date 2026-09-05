// 字号选择下拉（纯受控组件，由 Toolbar 连接 canvas-editor command）
import { useState, useRef, useEffect } from 'react';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface FontSizeSelectProps {
  /** 当前字号数字（对应 canvas-editor IRangeStyle.size） */
  value: number;
  /** 选择新字号时的回调 */
  onChange: (size: number) => void;
}

// 中文字号与像素值对应表（canvas-editor 使用 px 单位；96dpi 下 1pt ≈ 1.333px）
export const FONT_SIZES: { label: string; value: number }[] = [
  { label: '初号', value: 56 },   // 42pt
  { label: '小初', value: 48 },   // 36pt
  { label: '一号', value: 35 },   // 26pt
  { label: '小一', value: 32 },   // 24pt
  { label: '二号', value: 29 },   // 22pt
  { label: '小二', value: 24 },   // 18pt
  { label: '三号', value: 21 },   // 16pt
  { label: '小三', value: 20 },   // 15pt
  { label: '四号', value: 19 },   // 14pt
  { label: '小四', value: 16 },   // 12pt
  { label: '五号', value: 14 },   // 10.5pt
  { label: '小五', value: 12 },   // 9pt
  { label: '六号', value: 10 },   // 7.5pt
  { label: '小六', value: 9 },    // 6.5pt
  { label: '七号', value: 7 },    // 5.5pt
  { label: '八号', value: 6 },    // 5pt
];

export const DEFAULT_FONT_SIZE = 16; // 小四 = 16px ≈ 12pt
export const DEFAULT_FONT_SIZE_LABEL = '小四';

export function FontSizeSelect({ value, onChange }: FontSizeSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 当前展示标签：匹配 FONT_SIZES 时用其 label；未匹配显示像素值
  const matched = FONT_SIZES.find((s) => s.value === value);
  const currentSize = matched ? matched.label : `${value}px`;

  // 点击外部关闭下拉框
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleSelect = (size: (typeof FONT_SIZES)[0]) => {
    onChange(size.value);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-px flex h-6 min-w-[40px] items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <span className="truncate text-xs leading-4 text-[#454D5A]">{currentSize}</span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[80px] max-h-[600px] overflow-y-auto rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {FONT_SIZES.map((size) => (
            <button
              key={size.value}
              type="button"
              onClick={() => handleSelect(size)}
              className={`block w-full px-3 py-1.5 text-center text-[13px] hover:bg-[#f2f3f4] ${
                size.label === currentSize ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
