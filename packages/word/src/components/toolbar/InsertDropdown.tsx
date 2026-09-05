// 插入下拉：表格 / 图片上传 / 链接 / 日期 / 分割线 / 分页符 / 水印（对齐微信文档"插入▾"）
// Task 2.3：已从 TipTap 迁移到 canvas-editor API
import { useState, useRef, useCallback } from 'react';
import {
  ChevronRight,
  Table,
  ImagePlus,
  Link,
  Link2Off,
  Minus,
  Code,
  SplitSquareHorizontal,
  Droplet,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Pencil,
  Calendar,
} from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { useUIStore } from '../../store/uiStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatDateInsert, type DateInsertFormat } from '../../core/utils/dateInsert';
/** 6 种分割线样式（对齐旧系统 data-separator 值） */
const HR_SEPARATORS: { label: string; value: string }[] = [
  { label: '实线', value: '0,0' },
  { label: '虚线', value: '1,1' },
  { label: '粗虚线', value: '3,1' },
  { label: '点线', value: '4,4' },
  { label: '双实线', value: '7,3,3,3' },
  { label: '粗实线', value: '6,2,2,2,2,2' },
];
import { WordInsertIcon, WordImageIcon, WordCaretDown } from '../../components/icons/wordIcons';
import { useImageInsert, useLinkDialog } from './useInsertActions';
import { WatermarkModal } from './WatermarkModal';

interface EditorRefProps {
  editor: Editor | null;
}

/** 图片直插按钮（对齐微信文档"图片"按钮，点击直接打开本地文件选择） */
export function InsertImageButton({ editor }: EditorRefProps) {
  const { open, input } = useImageInsert(editor);
  return (
    <>
      <button
        type="button"
        onClick={open}
        title="图片"
        aria-label="图片"
        className="mx-px flex h-6 shrink-0 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordImageIcon className="h-[18px] w-[18px] shrink-0" />
        <span className="cursor-default whitespace-nowrap text-xs leading-4 text-[#454D5A]">图片</span>
      </button>
      {input}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-[#41464f] hover:bg-[#f2f3f4] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="flex w-[22px] shrink-0 items-center justify-center">
        {Icon ? <Icon size={15} className="text-[#8f959e]" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SubMenuItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  const [subOpen, setSubOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setSubOpen(true)}
      onMouseLeave={() => setSubOpen(false)}
    >
      <button
        type="button"
        className="flex w-full items-center px-3 py-1.5 text-left text-[13px] text-[#41464f] hover:bg-[#f2f3f4]"
      >
        <span className="flex w-[22px] shrink-0 items-center justify-center">
          <Icon size={15} className="text-[#8f959e]" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        <ChevronRight size={13} className="shrink-0 text-[#8f959e]" />
      </button>
      {subOpen && (
        <div className="absolute top-0 left-full z-10 ml-1 min-w-[168px] rounded-md border border-[#e7e9eb] bg-white py-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

/** 把 HR_SEPARATORS 中的 "a,b,c" 字符串解析为 canvas-editor 所需的 dashArray: number[] */
function parseDashArray(s: string): number[] {
  return s.split(',').map((n) => Number(n)).filter((n) => Number.isFinite(n));
}

export function InsertDropdown({ editor }: EditorRefProps) {
  const [open, setOpen] = useState(false);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { open: openImagePicker, input: imageInput } = useImageInsert(editor);
  const linkDialog = useLinkDialog(editor);
  const { watermark, setWatermark } = useUIStore();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(wrapperRef, close, open);

  const openLinkDialog = linkDialog.openInsert;

  // 判断光标是否在超链接元素内（用于显示"编辑/取消链接"）
  const inLink = (() => {
    if (!editor) return false;
    try {
      const ctx = editor.command.getRangeContext();
      return !!ctx?.startElement?.url;
    } catch {
      return false;
    }
  })();

  const insertTable = () => {
    // 与旧系统一致：插入 3x3 无表头网格
    editor?.command.executeInsertTable(3, 3);
    setOpen(false);
  };

  const insertImage = () => {
    openImagePicker();
    setOpen(false);
  };

  // 插入日期：以纯文本方式写入编辑器（canvas-editor 的 date 元素是交互控件，此处简化为静态文本）
  const insertDate = (format: DateInsertFormat) => {
    if (!editor) return;
    const text = formatDateInsert(new Date(), format);
    editor.command.executeInsertElementList([{ value: text }]);
    setOpen(false);
  };

  // canvas-editor executeSeparator 接收 dashArray: number[] 与可选样式
  const insertDivider = (separator: string) => {
    editor?.command.executeSeparator(parseDashArray(separator));
    setOpen(false);
  };

  // 代码块：canvas-editor 无原生代码块，暂以禁用态占位（spec 偏差）
  const insertCodeBlock = () => {
    // no-op
    setOpen(false);
  };

  const insertPageBreak = () => {
    editor?.command.executePageBreak();
    setOpen(false);
  };

  // 判断光标是否在表格内（用于显示表格行列操作）
  const inTable = (() => {
    if (!editor) return false;
    try {
      const ctx = editor.command.getRangeContext();
      return !!ctx?.isTable;
    } catch {
      return false;
    }
  })();

  const openWatermark = () => {
    setOpen(false);
    setWatermarkOpen(true);
  };

  const handleWatermarkSubmit = (text: string) => {
    if (!editor) return;
    editor.command.executeAddWatermark({ data: text });
    setWatermark(text);
  };

  const handleWatermarkRemove = () => {
    editor?.command.executeDeleteWatermark();
    setWatermark(null);
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="插入"
        aria-label="插入"
        className="mx-px flex h-6 shrink-0 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordInsertIcon className="h-[18px] w-[18px] shrink-0" />
        <span className="cursor-default whitespace-nowrap text-xs leading-4 text-[#454D5A]">插入</span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[168px] rounded-md border border-[#e7e9eb] bg-white py-1 shadow-lg">
          <MenuItem icon={Table} label="表格" onClick={insertTable} />
          {inTable && (
            <>
              <MenuItem icon={ArrowUp} label="在上方插入行" onClick={() => editor?.command.executeInsertTableTopRow()} />
              <MenuItem icon={ArrowDown} label="在下方插入行" onClick={() => editor?.command.executeInsertTableBottomRow()} />
              <MenuItem icon={Trash2} label="删除行" onClick={() => editor?.command.executeDeleteTableRow()} />
              <MenuItem icon={ArrowLeft} label="在左侧插入列" onClick={() => editor?.command.executeInsertTableLeftCol()} />
              <MenuItem icon={ArrowRight} label="在右侧插入列" onClick={() => editor?.command.executeInsertTableRightCol()} />
              <MenuItem icon={Trash2} label="删除列" onClick={() => editor?.command.executeDeleteTableCol()} />
            </>
          )}
          <MenuItem icon={ImagePlus} label="图片（本地上传）" onClick={insertImage} />
          <MenuItem icon={Link} label="链接" onClick={openLinkDialog} />
          {inLink && (
            <>
              <MenuItem icon={Pencil} label="编辑链接" onClick={linkDialog.openEdit} />
              <MenuItem
                icon={Link2Off}
                label="取消链接"
                onClick={() => {
                  editor?.command.executeCancelHyperlink();
                  setOpen(false);
                }}
              />
            </>
          )}
          <SubMenuItem icon={Calendar} label="日期">
            <MenuItem label="yyyy-MM-dd" onClick={() => insertDate('date')} />
            <MenuItem label="yyyy-MM-dd HH:mm:ss" onClick={() => insertDate('datetime')} />
          </SubMenuItem>
          <SubMenuItem icon={Minus} label="分割线">
            {HR_SEPARATORS.map(({ label, value }) => (
              <MenuItem key={value} label={label} onClick={() => insertDivider(value)} />
            ))}
          </SubMenuItem>
          {/* canvas-editor 无原生代码块，禁用占位（spec 偏差） */}
          <MenuItem icon={Code} label="代码块" onClick={insertCodeBlock} disabled />
          <MenuItem icon={SplitSquareHorizontal} label="分页符" onClick={insertPageBreak} />
          <MenuItem icon={Droplet} label={watermark ? '修改水印' : '添加水印'} onClick={openWatermark} />
          {watermark && <MenuItem icon={Droplet} label="删除水印" onClick={handleWatermarkRemove} />}
        </div>
      )}

      {watermarkOpen && (
        <WatermarkModal
          initialValue={watermark}
          onSubmit={handleWatermarkSubmit}
          onRemove={handleWatermarkRemove}
          onClose={() => setWatermarkOpen(false)}
        />
      )}

      {linkDialog.dialog}

      {imageInput}
    </div>
  );
}
