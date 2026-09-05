// 标题级别选择（正文 / 标题1~6）
// Task 2.3：已从 TipTap 迁移到 canvas-editor executeTitle API
import { useState, useRef, useCallback } from 'react';
import { Heading1 } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { TitleLevel } from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useClickOutside } from '../../hooks/useClickOutside';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface HeadingSelectProps {
  editor: Editor | null;
  level: TitleLevel | null;
}

// canvas-editor TitleLevel 枚举值映射到 UI 标签
const LEVELS: { level: TitleLevel | null; label: string; fontSize: number }[] = [
  { level: null, label: '正文', fontSize: 16 },
  { level: TitleLevel.FIRST, label: '标题 1', fontSize: 26 },
  { level: TitleLevel.SECOND, label: '标题 2', fontSize: 24 },
  { level: TitleLevel.THIRD, label: '标题 3', fontSize: 22 },
  { level: TitleLevel.FOURTH, label: '标题 4', fontSize: 20 },
  { level: TitleLevel.FIFTH, label: '标题 5', fontSize: 18 },
  { level: TitleLevel.SIXTH, label: '标题 6', fontSize: 16 },
];

function labelOf(level: TitleLevel | null): string {
  const found = LEVELS.find((l) => l.level === level);
  return found?.label ?? '正文';
}

export function HeadingSelect({ editor, level }: HeadingSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  const current = labelOf(level);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-px flex h-6 min-w-[48px] items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <span className="truncate text-xs leading-4 text-[#454D5A]">{current}</span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[120px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {LEVELS.map(({ level: lvl, label, fontSize }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                // executeTitle(null) 表示回到正文；传 TitleLevel 枚举值设置标题
                editor?.command.executeTitle(lvl);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#f2f3f4] ${
                label === current ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
              style={{ fontSize }}
            >
              {lvl !== null && <Heading1 size={13} className="shrink-0 text-[#8f959e]" />}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 工具函数：从 rangeStyle 读取当前标题级别（null = 正文）
export function readLevelFromRange(rangeStyle: IRangeStyle | null): TitleLevel | null {
  if (!rangeStyle) return null;
  const l = rangeStyle.level;
  if (!l) return null;
  // canvas-editor 的 IRangeStyle.level 是 TitleLevel | null
  return l as TitleLevel | null;
}
