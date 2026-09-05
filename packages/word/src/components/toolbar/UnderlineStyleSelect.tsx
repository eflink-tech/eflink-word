// 下划线线型选择（对应旧系统下划线样式菜单）
// Task 2.3：已从 TipTap 迁移到 canvas-editor executeUnderline API
import { useState, useRef, useCallback } from 'react';
import type Editor from '@hufe921/canvas-editor';
import { TextDecorationStyle } from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useClickOutside } from '../../hooks/useClickOutside';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface UnderlineStyleSelectProps {
  editor: Editor | null;
  /** 当前下划线线型（来自 rangeStyle.textDecoration.style） */
  currentStyle: TextDecorationStyle | null;
}

// canvas-editor TextDecorationStyle 枚举值与 UI 标签映射
const UNDERLINE_STYLES: { label: string; value: TextDecorationStyle }[] = [
  { label: '单实线', value: TextDecorationStyle.SOLID },
  { label: '双实线', value: TextDecorationStyle.DOUBLE },
  { label: '虚线', value: TextDecorationStyle.DASHED },
  { label: '点线', value: TextDecorationStyle.DOTTED },
  { label: '波浪线', value: TextDecorationStyle.WAVY },
];

/** canvas-editor TextDecorationStyle → CSS textDecorationStyle */
function toCSS(style: TextDecorationStyle | null): 'solid' | 'double' | 'dashed' | 'dotted' | 'wavy' {
  if (!style) return 'solid';
  return style as unknown as 'solid' | 'double' | 'dashed' | 'dotted' | 'wavy';
}

/** 下划线线型选择下拉（无 caret 时仍显示下划线按钮旁的箭头） */
export function UnderlineStyleSelect({ editor, currentStyle }: UnderlineStyleSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  const handleSelect = (style: TextDecorationStyle) => {
    // executeUnderline(textDecoration?: ITextDecoration) —— 传入 style 即设置线型
    editor?.command.executeUnderline({ style });
    setOpen(false);
  };

  const renderLine = (style: TextDecorationStyle) => (
    <span
      className="text-transparent"
      style={{
        textDecorationLine: 'underline',
        textDecorationStyle: toCSS(style),
        textDecorationColor: '#475569',
        textDecorationThickness: style === TextDecorationStyle.DOUBLE ? 'auto' : '2px',
      }}
    >
      abc
    </span>
  );

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="下划线样式"
        className="-ml-px flex h-6 w-3 items-center justify-center rounded-[2px] transition-colors hover:bg-black/[0.08]"
      >
        <WordCaretDown />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[110px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {UNDERLINE_STYLES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-[13px] hover:bg-[#f2f3f4] ${
                value === currentStyle ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
            >
              <span>{label}</span>
              {renderLine(value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 工具函数：从 rangeStyle 读取当前下划线线型（null 表示未设置或不是下划线）
export function readUnderlineStyleFromRange(rangeStyle: IRangeStyle | null): TextDecorationStyle | null {
  if (!rangeStyle?.underline) return null;
  return rangeStyle.textDecoration?.style ?? TextDecorationStyle.SOLID;
}
