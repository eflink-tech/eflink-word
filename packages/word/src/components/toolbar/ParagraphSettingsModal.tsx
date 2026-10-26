// 段落设置 Modal（对齐 / 大纲级别 / 行距 / 页边距）
// Task 2.3：已从 TipTap 迁移到 canvas-editor API
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@eflink-tech/office-kit';
import type Editor from '@hufe921/canvas-editor';
import { RowFlex, TitleLevel } from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useUIStore } from '../../store/uiStore';

const SELECT_CLS =
  'w-full rounded border border-[#e7e9eb] bg-white px-2 py-1.5 text-[13px] text-[#1f2329] outline-none focus:border-[#3370ff] disabled:cursor-not-allowed disabled:bg-[#f2f3f4] disabled:text-[#8f959e]';

// 对齐选项（canvas-editor RowFlex 枚举值）
const ALIGN_OPTIONS: { value: RowFlex; labelKey: string }[] = [
  { value: RowFlex.LEFT, labelKey: 'word.align.left' },
  { value: RowFlex.CENTER, labelKey: 'word.align.center' },
  { value: RowFlex.RIGHT, labelKey: 'word.align.right' },
  { value: RowFlex.JUSTIFY, labelKey: 'word.align.justify' },
  { value: RowFlex.ALIGNMENT, labelKey: 'word.align.distributed' },
];

// 大纲级别选项（canvas-editor TitleLevel 枚举值，null = 正文）
const OUTLINE_OPTIONS: { value: TitleLevel | null; labelKey: string }[] = [
  { value: null, labelKey: 'word.heading.normal' },
  { value: TitleLevel.FIRST, labelKey: 'word.heading.h1' },
  { value: TitleLevel.SECOND, labelKey: 'word.heading.h2' },
  { value: TitleLevel.THIRD, labelKey: 'word.heading.h3' },
  { value: TitleLevel.FOURTH, labelKey: 'word.heading.h4' },
  { value: TitleLevel.FIFTH, labelKey: 'word.heading.h5' },
  { value: TitleLevel.SIXTH, labelKey: 'word.heading.h6' },
];

// 行距倍数选项（canvas-editor executeRowMargin 的 payload 是数字倍数）
const LINE_HEIGHT_OPTIONS: number[] = [1, 1.5, 2, 2.5, 3];

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
  const { t } = useI18n();
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
        aria-label={t('word.paragraph.title')}
        tabIndex={-1}
        autoFocus
        className="w-[680px] rounded-md border border-[#e7e9eb] bg-white shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e7e9eb] px-6 py-3.5">
          <div className="text-[14px] font-medium text-[#1f2329]">{t('word.paragraph.title')}</div>
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

        <div className="flex gap-1 border-b border-[#e7e9eb] px-6">
          <span className="border-b-2 border-[#3370ff] px-2 py-2.5 text-[13px] text-[#1f2329]">
            {t('word.paragraph.tabIndent')}
          </span>
          <button
            type="button"
            disabled
            className="cursor-not-allowed px-2 py-2.5 text-[13px] text-[#8f959e]"
          >
            {t('word.paragraph.tabBreaks')}
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed px-2 py-2.5 text-[13px] text-[#8f959e]"
          >
            {t('word.paragraph.tabAsian')}
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">{t('word.paragraph.general')}</div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">{t('word.paragraph.alignment')}</span>
                <select
                  className={SELECT_CLS}
                  value={align}
                  onChange={(e) => setAlign(e.target.value as RowFlex)}
                >
                  {ALIGN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">{t('word.paragraph.outlineLevel')}</span>
                <select
                  className={SELECT_CLS}
                  value={level ?? ''}
                  onChange={(e) =>
                    setLevel(e.target.value === '' ? null : (e.target.value as TitleLevel))
                  }
                >
                  {OUTLINE_OPTIONS.map((o) => (
                    <option key={o.labelKey} value={o.value ?? ''}>
                      {t(o.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">{t('word.paragraph.margins')}</div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label={t('word.paragraph.top')} unit={t('word.paragraph.px')} value={marginTop} onChange={setMarginTop} />
              <NumberField label={t('word.paragraph.bottom')} unit={t('word.paragraph.px')} value={marginBottom} onChange={setMarginBottom} />
              <NumberField label={t('word.paragraph.left')} unit={t('word.paragraph.px')} value={marginLeft} onChange={setMarginLeft} />
              <NumberField label={t('word.paragraph.right')} unit={t('word.paragraph.px')} value={marginRight} onChange={setMarginRight} />
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">{t('word.paragraph.spacing')}</div>
            <div className="grid grid-cols-2 gap-4">
              <NumberField label={t('word.paragraph.before')} unit={t('word.paragraph.pt')} value={0} disabled onChange={() => {}} />
              <NumberField label={t('word.paragraph.after')} unit={t('word.paragraph.pt')} value={0} disabled onChange={() => {}} />
              <label className="block">
                <span className="mb-1.5 block text-[12px] text-[#8f959e]">{t('word.paragraph.lineSpacing')}</span>
                <select
                  className={SELECT_CLS}
                  value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                >
                  {LINE_HEIGHT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o === 1 ? t('word.paragraph.single') : t('word.paragraph.multiple', { value: o })}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label={t('word.paragraph.setValue')}
                unit={t('word.paragraph.times')}
                value={lineHeight}
                disabled
                onChange={() => {}}
              />
            </div>
          </section>

          <section>
            <div className="mb-2.5 text-[12px] text-[#8f959e]">{t('word.paragraph.preview')}</div>
            <div className="overflow-hidden rounded border border-[#e7e9eb] bg-[#f2f3f4] px-4 py-3">
              <div className="bg-white px-4 py-3 text-[13px] text-[#1f2329]">
                <p>{t('word.paragraph.previewText')}</p>
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
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="rounded bg-[#3370ff] px-3 py-1.5 text-[13px] text-white hover:bg-[#2860e1]"
          >
            {t('action.confirm')}
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
