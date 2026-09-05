// 段落设置 Modal（对齐 / 大纲级别 / 行距 / 页边距）
// Task 2.3：已从 TipTap 迁移到 canvas-editor API
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { RowFlex, TitleLevel } from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useUIStore } from '../../store/uiStore';

const SELECT_CLS =
  'w-full rounded border border-[#e7e9eb] bg-white px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff] disabled:cursor-not-allowed disabled:bg-[#f2f3f4] disabled:text-[#8f959e]';

// 对齐选项（canvas-editor RowFlex 枚举值）
const ALIGN_OPTIONS: { value: RowFlex; label: string }[] = [
  { value: RowFlex.LEFT, label: '左对齐' },
  { value: RowFlex.CENTER, label: '居中' },
  { value: RowFlex.RIGHT, label: '右对齐' },
  { value: RowFlex.JUSTIFY, label: '两端对齐' },
  { value: RowFlex.ALIGNMENT, label: '分散对齐' },
];

// 大纲级别选项（canvas-editor TitleLevel 枚举值，null = 正文）
const OUTLINE_OPTIONS: { value: TitleLevel | null; label: string }[] = [
  { value: null, label: '正文' },
  { value: TitleLevel.FIRST, label: '标题 1' },
  { value: TitleLevel.SECOND, label: '标题 2' },
  { value: TitleLevel.THIRD, label: '标题 3' },
  { value: TitleLevel.FOURTH, label: '标题 4' },
  { value: TitleLevel.FIFTH, label: '标题 5' },
  { value: TitleLevel.SIXTH, label: '标题 6' },
];

// 行距倍数选项（canvas-editor executeRowMargin 的 payload 是数字倍数）
const LINE_HEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '单倍' },
  { value: 1.5, label: '1.5 倍' },
  { value: 2, label: '2 倍' },
  { value: 2.5, label: '2.5 倍' },
  { value: 3, label: '3 倍' },
];

export interface ParagraphSettingsModalProps {
  editor: Editor | null;
  rangeStyle: IRangeStyle | null;
  onClose: () => void;
}

export function ParagraphSettingsModal({
  editor,
  rangeStyle,
  onClose,
}: ParagraphSettingsModalProps) {
  const { margin, setMarginCustom } = useUIStore();

  // 本地 draft state（初始化自 rangeStyle）
  const [align, setAlign] = useState<RowFlex>(
    (rangeStyle?.rowFlex as RowFlex) ?? RowFlex.LEFT,
  );
  const [level, setLevel] = useState<TitleLevel | null>(rangeStyle?.level ?? null);
  const [lineHeight, setLineHeight] = useState<number>(rangeStyle?.rowMargin ?? 1);

  // 页边距 draft state（初始化自 uiStore.margin）
  const [marginTop, setMarginTop] = useState(margin.top);
  const [marginRight, setMarginRight] = useState(margin.right);
  const [marginBottom, setMarginBottom] = useState(margin.bottom);
  const [marginLeft, setMarginLeft] = useState(margin.left);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOk = () => {
    if (editor) {
      editor.command.executeRowFlex(align);
      editor.command.executeTitle(level);
      editor.command.executeRowMargin(lineHeight);
    }
    // 页边距变更
    const next = { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft };
    if (
      next.top !== margin.top ||
      next.right !== margin.right ||
      next.bottom !== margin.bottom ||
      next.left !== margin.left
    ) {
      setMarginCustom(next);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="段落"
        tabIndex={-1}
        autoFocus
        className="w-[680px] rounded-md border border-[#e7e9eb] bg-white shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e7e9eb] px-6 py-3.5">
          <div className="text-[14px] font-medium text-[#1f2329]">段落</div>
          <button
            type="button"
            onClick={onClose}
            title="关闭"
            aria-label="关闭"
            className="flex h-7 w-7 items-center justify-center rounded-[2px] text-[#51565f] hover:bg-[#f2f3f4]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[#e7e9eb] px-6">
          <span className="border-b-2 border-[#3370ff] px-2 py-2.5 text-[13px] text-[#1f2329]">
            缩进和间距
          </span>
          <button
            type="button"
            disabled
            className="cursor-not-allowed px-2 py-2.5 text-[13px] text-[#8f959e]"
          >
            换行和分页
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed px-2 py-2.5 text-[13px] text-[#8f959e]"
          >
            中文版式
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">常规</div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">对齐方式</span>
                <select
                  className={SELECT_CLS}
                  value={align}
                  onChange={(e) => setAlign(e.target.value as RowFlex)}
                >
                  {ALIGN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">大纲级别</span>
                <select
                  className={SELECT_CLS}
                  value={level ?? ''}
                  onChange={(e) =>
                    setLevel(e.target.value === '' ? null : (e.target.value as TitleLevel))
                  }
                >
                  {OUTLINE_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value ?? ''}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">页边距</div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="上" unit="px" value={marginTop} onChange={setMarginTop} />
              <NumberField label="下" unit="px" value={marginBottom} onChange={setMarginBottom} />
              <NumberField label="左" unit="px" value={marginLeft} onChange={setMarginLeft} />
              <NumberField label="右" unit="px" value={marginRight} onChange={setMarginRight} />
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">间距</div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="段前" unit="磅" value={0} disabled onChange={() => {}} />
              <NumberField label="段后" unit="磅" value={0} disabled onChange={() => {}} />
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">行距</span>
                <select
                  className={SELECT_CLS}
                  value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                >
                  {LINE_HEIGHT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="设置值"
                unit="倍"
                value={lineHeight}
                disabled
                onChange={() => {}}
              />
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">预览</div>
            <div className="overflow-hidden rounded border border-[#e7e9eb] bg-[#f2f3f4] px-4 py-3">
              <div className="bg-white px-4 py-3 text-[13px] text-[#1f2329]">
                <p>这是段落预览示例。调整对齐、行距时，此处会即时反映效果。</p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#e7e9eb] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-[13px] text-[#41464f] hover:bg-[#f2f3f4]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="rounded bg-[#3370ff] px-3 py-1.5 text-[13px] text-white hover:bg-[#2860e1]"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  disabled,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-[#8f959e]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={0.1}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={SELECT_CLS}
        />
        <span className="shrink-0 text-[12px] text-[#8f959e]">{unit}</span>
      </div>
    </label>
  );
}
