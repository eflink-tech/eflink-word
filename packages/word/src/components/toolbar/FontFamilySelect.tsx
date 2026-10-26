// 字体选择下拉（纯受控组件，由 Toolbar 连接 canvas-editor command）
import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@eflink-tech/office-kit';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface FontFamilySelectProps {
  /** 当前字体名（对应 canvas-editor IRangeStyle.font） */
  value: string;
  /** 选择新字体时的回调 */
  onChange: (font: string) => void;
}

const FONTS: { labelKey?: string; label?: string; value: string }[] = [
  { labelKey: 'word.font.microsoftYaHei', value: 'Microsoft YaHei' },
  { labelKey: 'word.font.stsong', value: 'STSong' },
  { labelKey: 'word.font.stheiti', value: 'STHeiti' },
  { labelKey: 'word.font.stfangsong', value: 'STFangsong' },
  { labelKey: 'word.font.stkaiti', value: 'STKaiti' },
  { labelKey: 'word.font.sthupo', value: 'STHupo' },
  { labelKey: 'word.font.stliti', value: 'STLiti' },
  { labelKey: 'word.font.stxinwei', value: 'STXinwei' },
  { labelKey: 'word.font.stxingkai', value: 'STXingkai' },
  { labelKey: 'word.font.stzhongsong', value: 'STZhongsong' },
  { labelKey: 'word.font.stcaiyun', value: 'STCaiyun' },
  { labelKey: 'word.font.simsun', value: 'SimSun' },
  { labelKey: 'word.font.simhei', value: 'SimHei' },
  { labelKey: 'word.font.kaiti', value: 'KaiTi' },
  { labelKey: 'word.font.fangsong', value: 'FangSong' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Segoe UI', value: 'Segoe UI' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Ink Free', value: 'Ink Free' },
  { label: 'Fantasy', value: 'Fantasy' },
];

// 未显式设置字体时展示的占位文案（对齐微信文档"默认字体"）
const DEFAULT_FONT_VALUE = 'Microsoft YaHei';

export function FontFamilySelect({ value, onChange }: FontFamilySelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const labelOf = (font: (typeof FONTS)[number]) =>
    font.labelKey ? t(font.labelKey) : (font.label ?? font.value);

  // 当前展示标签：匹配 FONTS 时用其本地化名称，未匹配或默认字体显示"默认字体"
  const matched = FONTS.find((f) => f.value === value);
  const currentFontLabel =
    !value || value === DEFAULT_FONT_VALUE || !matched
      ? t('word.font.default')
      : labelOf(matched);

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

  const handleSelect = (font: (typeof FONTS)[0]) => {
    onChange(font.value);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mx-px flex h-6 min-w-[64px] max-w-[100px] items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <span
          className="truncate text-xs leading-4 text-[#454D5A]"
          style={
            matched && value !== DEFAULT_FONT_VALUE ? { fontFamily: matched.value } : undefined
          }
        >
          {currentFontLabel}
        </span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[168px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {FONTS.map((font) => {
            const label = labelOf(font);
            return (
              <button
                key={font.value}
                type="button"
                onClick={() => handleSelect(font)}
                className={`block w-full px-3 py-1.5 text-center text-[13px] hover:bg-[#f2f3f4] ${
                  label === currentFontLabel ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
                }`}
                style={{ fontFamily: font.value }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
