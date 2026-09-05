// 对齐下拉（纯受控组件，由 Toolbar 连接 canvas-editor executeRowFlex）
import { useState, useRef, useCallback } from 'react';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Check, type LucideIcon } from 'lucide-react';
import type { RowFlex } from '@hufe921/canvas-editor';
import { useClickOutside } from '../../hooks/useClickOutside';
import { WordAlignIcon, WordCaretDown } from '../../components/icons/wordIcons';

interface AlignSelectProps {
  /** 当前对齐方式（对应 canvas-editor IRangeStyle.rowFlex） */
  value: RowFlex | null;
  /** 选择新对齐方式时的回调 */
  onChange: (flex: RowFlex) => void;
}

// canvas-editor RowFlex 枚举值（字符串字面量）：
//   LEFT='left', CENTER='center', RIGHT='right',
//   ALIGNMENT='alignment' (两端对齐), JUSTIFY='justify' (分散对齐)
const ALIGNMENTS: { value: RowFlex; label: string; icon: LucideIcon }[] = [
  { value: 'left' as RowFlex, label: '左对齐', icon: AlignLeft },
  { value: 'center' as RowFlex, label: '居中', icon: AlignCenter },
  { value: 'right' as RowFlex, label: '右对齐', icon: AlignRight },
  { value: 'alignment' as RowFlex, label: '两端对齐', icon: AlignJustify },
  { value: 'justify' as RowFlex, label: '分散对齐', icon: AlignJustify },
];

const DEFAULT_ALIGN: RowFlex = 'left' as RowFlex;

export function AlignSelect({ value, onChange }: AlignSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = value ?? DEFAULT_ALIGN;

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  // value 由父组件（Toolbar）从 store 订阅并传入，无需本地 effect 同步

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="对齐"
        aria-label="对齐"
        className="mx-px flex h-6 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordAlignIcon className="h-[18px] w-[18px]" />
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[104px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {ALIGNMENTS.map(({ value: flexValue, label, icon: Icon }) => (
            <button
              key={flexValue}
              type="button"
              onClick={() => {
                onChange(flexValue);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[#f2f3f4] ${
                flexValue === current ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
            >
              <Icon size={15} className="text-[#8f959e]" />
              <span className="flex-1">{label}</span>
              {flexValue === current && <Check size={13} className="text-[#4991f2]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
