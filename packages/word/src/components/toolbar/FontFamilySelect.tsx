// 字体选择下拉（纯受控组件，由 Toolbar 连接 canvas-editor command）
import { useState, useRef, useEffect } from 'react';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface FontFamilySelectProps {
  /** 当前字体名（对应 canvas-editor IRangeStyle.font） */
  value: string;
  /** 选择新字体时的回调 */
  onChange: (font: string) => void;
}

const FONTS = [
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '华文宋体', value: 'STSong' },
  { label: '华文黑体', value: 'STHeiti' },
  { label: '华文仿宋', value: 'STFangsong' },
  { label: '华文楷体', value: 'STKaiti' },
  { label: '华文琥珀', value: 'STHupo' },
  { label: '华文隶书', value: 'STLiti' },
  { label: '华文新魏', value: 'STXinwei' },
  { label: '华文行楷', value: 'STXingkai' },
  { label: '华文中宋', value: 'STZhongsong' },
  { label: '华文彩云', value: 'STCaiyun' },
  { label: '宋体', value: 'SimSun' },
  { label: '黑体', value: 'SimHei' },
  { label: '楷体', value: 'KaiTi' },
  { label: '仿宋', value: 'FangSong' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Segoe UI', value: 'Segoe UI' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Ink Free', value: 'Ink Free' },
  { label: 'Fantasy', value: 'Fantasy' },
];

// 未显式设置字体时展示的占位文案（对齐微信文档"默认字体"）
const DEFAULT_FONT_VALUE = 'Microsoft YaHei';
const DEFAULT_FONT_LABEL = '默认字体';

export function FontFamilySelect({ value, onChange }: FontFamilySelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 当前展示标签：匹配 FONTS 时用其 label，未匹配或默认字体显示"默认字体"
  const currentFontLabel =
    !value || value === DEFAULT_FONT_VALUE
      ? DEFAULT_FONT_LABEL
      : FONTS.find((f) => f.value === value)?.label ?? DEFAULT_FONT_LABEL;

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
          style={currentFontLabel === DEFAULT_FONT_LABEL ? undefined : { fontFamily: currentFontLabel }}
        >
          {currentFontLabel}
        </span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[168px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {FONTS.map((font) => (
            <button
              key={font.value}
              type="button"
              onClick={() => handleSelect(font)}
              className={`block w-full px-3 py-1.5 text-center text-[13px] hover:bg-[#f2f3f4] ${
                font.label === currentFontLabel ? 'bg-[#f2f3f4] text-[#1f2329]' : 'text-[#454D5A]'
              }`}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
