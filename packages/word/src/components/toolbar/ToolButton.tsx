// 微信文档（企业微信 Word 在线编辑）工具栏基础控件：
// 图标 18px、按钮间距收紧、圆角 2px、hover/激活 rgba(0,0,0,0.08)、禁用 40% 透明
import type { LucideIcon } from 'lucide-react';
import { WordCaretDown } from '../../components/icons/wordIcons';

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

/** 纯图标按钮 */
export function ToolButton({
  icon: Icon,
  label,
  onClick,
  onDoubleClick,
  onMouseDown,
  active = false,
  disabled = false,
  className = '',
}: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`mx-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] transition-colors ${
        active
          ? 'bg-black/[0.08] text-[#454D5A]'
          : 'text-[#454D5A] hover:bg-black/[0.08]'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      <Icon size={18} />
    </button>
  );
}

interface WordIconButtonProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

/** 使用微信文档原始 SVG 图标的纯图标按钮 */
export function WordIconButton({
  icon: Icon,
  label,
  onClick,
  onDoubleClick,
  onMouseDown,
  active = false,
  disabled = false,
  className = '',
}: WordIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`mx-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] transition-colors ${
        active ? 'bg-black/[0.08]' : 'hover:bg-black/[0.08]'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

interface TextToolButtonProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
  caret?: boolean;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

/** 图标 + 文字 + 小箭头按钮（菜单 / 插入 / 快捷工具等） */
export function TextToolButton({
  icon: Icon,
  label,
  onClick,
  caret = false,
  active = false,
  disabled = false,
  className = '',
}: TextToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`mx-px flex h-6 shrink-0 items-center gap-px rounded-[2px] px-0.5 transition-colors ${
        active ? 'bg-black/[0.08]' : 'hover:bg-black/[0.08]'
      } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      <span className="cursor-default whitespace-nowrap text-xs leading-4 text-[#454D5A]">{label}</span>
      {caret && <WordCaretDown className="shrink-0" />}
    </button>
  );
}

/** 分组分隔线：1px 宽竖线，左右收紧 */
export function ToolbarDivider() {
  return <div className="mx-0.5 h-3.5 w-px shrink-0 bg-black/[0.08]" />;
}
