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
import { useI18n } from '@eflink-tech/office-kit';
import type Editor from '@hufe921/canvas-editor';
import { useUIStore } from '../../store/uiStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import { formatDateInsert, type DateInsertFormat } from '../../core/utils/dateInsert';
/** 6 种分割线样式（对齐旧系统 data-separator 值） */
const HR_SEPARATORS: { labelKey: string; value: string }[] = [
  { labelKey: 'word.insert.hrSolid', value: '0,0' },
  { labelKey: 'word.insert.hrDashed', value: '1,1' },
  { labelKey: 'word.insert.hrThickDashed', value: '3,1' },
  { labelKey: 'word.insert.hrDotted', value: '4,4' },
  { labelKey: 'word.insert.hrDouble', value: '7,3,3,3' },
  { labelKey: 'word.insert.hrThick', value: '6,2,2,2,2,2' },
];
import { WordInsertIcon, WordImageIcon, WordCaretDown } from '../../components/icons/wordIcons';
import { useImageInsert, useLinkDialog } from './useInsertActions';
import { WatermarkModal } from './WatermarkModal';

interface EditorRefProps {
  editor: Editor | null;
}

/** 图片直插按钮（对齐微信文档"图片"按钮，点击直接打开本地文件选择） */
export function InsertImageButton({ editor }: EditorRefProps) {
  const { t } = useI18n();
  const { open, input } = useImageInsert(editor);
  return (
    <>
      <button
        type="button"
        onClick={open}
        title={t('word.insert.image')}
        aria-label={t('word.insert.image')}
        className="mx-px flex h-6 shrink-0 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordImageIcon className="h-[18px] w-[18px] shrink-0" />
        <span className="cursor-default whitespace-nowrap text-xs leading-4 text-[#454D5A]">{t('word.insert.image')}</span>
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
  const { t } = useI18n();
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
        title={t('word.insert.menu')}
        aria-label={t('word.insert.menu')}
        className="mx-px flex h-6 shrink-0 items-center gap-px rounded-[2px] px-0.5 transition-colors hover:bg-black/[0.08]"
      >
        <WordInsertIcon className="h-[18px] w-[18px] shrink-0" />
        <span className="cursor-default whitespace-nowrap text-xs leading-4 text-[#454D5A]">{t('word.insert.menu')}</span>
        <WordCaretDown className="shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[168px] rounded-md border border-[#e7e9eb] bg-white py-1 shadow-lg">
          <MenuItem icon={Table} label={t('word.insert.table')} onClick={insertTable} />
          {inTable && (
            <>
              <MenuItem icon={ArrowUp} label={t('word.insert.rowAbove')} onClick={() => editor?.command.executeInsertTableTopRow()} />
              <MenuItem icon={ArrowDown} label={t('word.insert.rowBelow')} onClick={() => editor?.command.executeInsertTableBottomRow()} />
              <MenuItem icon={Trash2} label={t('word.insert.rowDelete')} onClick={() => editor?.command.executeDeleteTableRow()} />
              <MenuItem icon={ArrowLeft} label={t('word.insert.colLeft')} onClick={() => editor?.command.executeInsertTableLeftCol()} />
              <MenuItem icon={ArrowRight} label={t('word.insert.colRight')} onClick={() => editor?.command.executeInsertTableRightCol()} />
              <MenuItem icon={Trash2} label={t('word.insert.colDelete')} onClick={() => editor?.command.executeDeleteTableCol()} />
            </>
          )}
          <MenuItem icon={ImagePlus} label={t('word.insert.imageUpload')} onClick={insertImage} />
          <MenuItem icon={Link} label={t('word.insert.link')} onClick={openLinkDialog} />
          {inLink && (
            <>
              <MenuItem icon={Pencil} label={t('word.insert.editLink')} onClick={linkDialog.openEdit} />
              <MenuItem
                icon={Link2Off}
                label={t('word.insert.removeLink')}
                onClick={() => {
                  editor?.command.executeCancelHyperlink();
                  setOpen(false);
                }}
              />
            </>
          )}
          <SubMenuItem icon={Calendar} label={t('word.insert.date')}>
            <MenuItem label="yyyy-MM-dd" onClick={() => insertDate('date')} />
            <MenuItem label="yyyy-MM-dd HH:mm:ss" onClick={() => insertDate('datetime')} />
          </SubMenuItem>
          <SubMenuItem icon={Minus} label={t('word.insert.separator')}>
            {HR_SEPARATORS.map(({ labelKey, value }) => (
              <MenuItem key={value} label={t(labelKey)} onClick={() => insertDivider(value)} />
            ))}
          </SubMenuItem>
          {/* canvas-editor 无原生代码块，禁用占位（spec 偏差） */}
          <MenuItem icon={Code} label={t('word.insert.codeBlock')} onClick={insertCodeBlock} disabled />
          <MenuItem icon={SplitSquareHorizontal} label={t('word.insert.pageBreak')} onClick={insertPageBreak} />
          <MenuItem icon={Droplet} label={watermark ? t('word.insert.watermarkEdit') : t('word.insert.watermarkAdd')} onClick={openWatermark} />
          {watermark && <MenuItem icon={Droplet} label={t('word.insert.watermarkRemove')} onClick={handleWatermarkRemove} />}
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
