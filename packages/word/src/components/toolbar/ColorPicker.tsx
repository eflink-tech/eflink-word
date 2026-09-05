// 字体颜色 / 高亮 / 底纹颜色 — 纯受控 UI 层，由 Toolbar 连接 canvas-editor command
// - color/highlight：Toolbar 连接 executeColor / executeHighlight
// - shading：canvas-editor 无对应命令，Toolbar 以本地 state 包装保持视觉一致
import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ColorPicker as StandaloneColorPicker, type ColorSelectOptions } from '../../components/color';
import {
  WordHighlightIcon,
  WordFontColorIcon,
  WordShadingIcon,
  WordCaretDown,
} from '../../components/icons/wordIcons';

export type ToolbarColorMode = 'color' | 'highlight' | 'shading';

interface ColorPickerProps {
  /** 当前颜色值（null 表示默认） */
  value: string | null;
  /** 选中颜色时的回调 */
  onSelect: (color: string, options?: ColorSelectOptions) => void;
  /** 点击"默认"按钮时的回调 */
  onDefault: () => void;
  /** 模式（仅决定图标与标题） */
  mode: ToolbarColorMode;
}

export function recentStorageKeyForMode(mode: ToolbarColorMode): string {
  return `eflink-word:recent-colors:${mode}`;
}

const MODE_TITLES: Record<ToolbarColorMode, string> = {
  color: '字体颜色',
  highlight: '高亮',
  shading: '底纹颜色',
};

export function ColorPicker({ value, onSelect, onDefault, mode }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  // 图标下色条颜色：null 时显示白色（"无颜色"）
  const barColor = value ?? '#ffffff';

  const handleSelect = (color: string, options?: ColorSelectOptions) => {
    onSelect(color, options);
    if (options?.close !== false) setOpen(false);
  };

  const handleDefault = () => {
    onDefault();
    setOpen(false);
  };

  const Icon =
    mode === 'color' ? WordFontColorIcon : mode === 'highlight' ? WordHighlightIcon : WordShadingIcon;

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={MODE_TITLES[mode]}
        aria-label={MODE_TITLES[mode]}
        className="mx-px flex h-6 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <span className="relative flex h-[18px] w-[18px] items-center justify-center">
          <Icon className="h-[18px] w-[18px]" />
          <span
            className="absolute bottom-0 left-[1px] right-[1px] h-[2px] border border-black/[0.12]"
            style={{ backgroundColor: barColor }}
            data-testid="toolbar-color-bar"
          />
        </span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1">
          <StandaloneColorPicker
            open={open}
            onOpenChange={setOpen}
            value={value}
            recentStorageKey={recentStorageKeyForMode(mode)}
            onSelect={handleSelect}
            onDefault={handleDefault}
          />
        </div>
      )}
    </div>
  );
}
