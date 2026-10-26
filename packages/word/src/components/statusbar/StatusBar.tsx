import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Fullscreen,
  List,
  Settings,
  Printer,
  Check,
  Pencil,
} from 'lucide-react';
import { PaperSizeIcon, PaperDirectionIcon, PageMarginIcon } from './StatusBarIcons';
import { useUIStore, PAPER_SIZES, MARGIN_PRESETS } from '../../store/uiStore';
import { useEditorStore } from '../../store/editorStore';
import { useDocumentStore } from '../../store/documentStore';
import { RenameDialog } from '../common/RenameDialog';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useI18n } from '@eflink-tech/office-kit';
import type Editor from '@hufe921/canvas-editor';
import { PageMode } from '@hufe921/canvas-editor';

interface StatusBarProps {
  editor: Editor | null;
}

const BTN =
  'w-6 h-6 flex items-center justify-center cursor-pointer mx-0.5 rounded hover:bg-slate-100 hover:text-slate-700 border-0 bg-transparent p-0';

const PAPER_LABEL_KEYS: Record<string, string> = {
  法律用纸: 'word.paper.legal',
  信纸: 'word.paper.letter',
};

const MARGIN_LABEL_KEYS: Record<string, string> = {
  标准: 'word.margin.normal',
  窄: 'word.margin.narrow',
  适中: 'word.margin.moderate',
  宽: 'word.margin.wide',
};

/** 底部下拉通用容器 */
function FooterDropdown({
  open,
  children,
  width = 120,
}: {
  open: boolean;
  children: React.ReactNode;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 z-[9999] mb-1 rounded border border-slate-200 bg-white py-1 shadow-lg"
      style={{ width }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-blue-50 ${
        active ? 'text-blue-600' : 'text-slate-700'
      }`}
    >
      <span>{children}</span>
      {active && <Check size={13} />}
    </button>
  );
}

/** 方向选择（纵向/横向） */
function PaperDirectionMenu() {
  const { t } = useI18n();
  const { paperDirection, setPaperDirection } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={BTN}
        onClick={() => setOpen((v) => !v)}
        title={t('word.status.paperDirection')}
      >
        <PaperDirectionIcon />
      </button>
      <FooterDropdown open={open} width={90}>
        <DropdownItem
          active={paperDirection === 'vertical'}
          onClick={() => {
            setPaperDirection('vertical');
            setOpen(false);
          }}
        >
          {t('word.status.portrait')}
        </DropdownItem>
        <DropdownItem
          active={paperDirection === 'horizontal'}
          onClick={() => {
            setPaperDirection('horizontal');
            setOpen(false);
          }}
        >
          {t('word.status.landscape')}
        </DropdownItem>
      </FooterDropdown>
    </div>
  );
}

/** 纸张类型选择 */
function PaperSizeMenu() {
  const { t } = useI18n();
  const { paperSize, setPaperSize } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={BTN}
        onClick={() => setOpen((v) => !v)}
        title={t('word.status.paperSize')}
      >
        <PaperSizeIcon />
      </button>
      <FooterDropdown open={open} width={100}>
        {PAPER_SIZES.map((p) => (
          <DropdownItem
            key={p.label}
            active={p.label === paperSize.label}
            onClick={() => {
              setPaperSize(p.label);
              setOpen(false);
            }}
          >
            {PAPER_LABEL_KEYS[p.label] ? t(PAPER_LABEL_KEYS[p.label]) : p.label}
          </DropdownItem>
        ))}
      </FooterDropdown>
    </div>
  );
}

/** 页边距预设 */
function MarginMenu() {
  const { t } = useI18n();
  const { margin, setMarginPreset, setSettingsOpen } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={BTN}
        onClick={() => setOpen((v) => !v)}
        title={t('word.status.margin')}
      >
        <PageMarginIcon />
      </button>
      <FooterDropdown open={open} width={100}>
        {MARGIN_PRESETS.map((m) => (
          <DropdownItem
            key={m.label}
            active={m.label === margin.label}
            onClick={() => {
              setMarginPreset(m.label);
              setOpen(false);
            }}
          >
            {MARGIN_LABEL_KEYS[m.label] ? t(MARGIN_LABEL_KEYS[m.label]) : m.label}
          </DropdownItem>
        ))}
        <DropdownItem
          active={margin.label === '自定义'}
          onClick={() => {
            setSettingsOpen(true, 'margin');
            setOpen(false);
          }}
        >
          {t('word.status.custom')}
        </DropdownItem>
      </FooterDropdown>
    </div>
  );
}

// 旧系统样式：30px 高度, 12px 字体, 三段式布局
export function StatusBar({ editor }: StatusBarProps) {
  const { t } = useI18n();
  const { catalogOpen, toggleCatalog, setSettingsOpen } = useUIStore();
  // 保存状态：内容变化置脏（红点），云端保存成功后恢复已保存
  const isDirty = useEditorStore((s) => s.isDirty);
  // 文档名：跟随 documentStore.currentDocument.title（renameDocument 内部同步更新）
  const docTitle = useDocumentStore((s) => s.currentDocument?.title) ?? t('word.status.unnamed');
  const [renameOpen, setRenameOpen] = useState(false);
  // canvas-editor 事件驱动状态
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const [pageMode, setPageMode] = useState<PageMode>(PageMode.PAGING);

  // 事件订阅
  useEffect(() => {
    if (!editor) return;
    const bus = editor.eventBus;

    // canvas-editor 发出 0 索引页码，转换为 1 索引显示
    const onPageNoChange = (pageNo: number) => setCurrentPage(pageNo + 1);
    bus.on('intersectionPageNoChange', onPageNoChange);
    bus.on('pageSizeChange', setTotalPages);
    bus.on('pageScaleChange', setScale);
    bus.on('pageModeChange', setPageMode);

    // 初始化：获取当前字数（async）
    editor.command.getWordCount().then(setWordCount).catch(() => {});

    return () => {
      bus.off('intersectionPageNoChange', onPageNoChange);
      bus.off('pageSizeChange', setTotalPages);
      bus.off('pageScaleChange', setScale);
      bus.off('pageModeChange', setPageMode);
    };
  }, [editor]);

  // 字数防抖刷新（contentChange 时）
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;

    const onContentChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        editor.command.getWordCount().then(setWordCount).catch(() => {});
      }, 300);
    };

    editor.eventBus.on('contentChange', onContentChange);
    return () => {
      clearTimeout(timer);
      editor.eventBus.off('contentChange', onContentChange);
    };
  }, [editor]);

  // 缩放操作：直连 canvas-editor 命令
  const zoomIn = useCallback(() => {
    editor?.command.executePageScaleAdd();
  }, [editor]);
  const zoomOut = useCallback(() => {
    editor?.command.executePageScaleMinus();
  }, [editor]);
  const zoomReset = useCallback(() => {
    editor?.command.executePageScaleRecovery();
  }, [editor]);
  const handlePrint = useCallback(() => {
    if (!editor) return;
    const currentMode = pageMode;
    // 打印预览始终以分页模式显示
    if (currentMode !== PageMode.PAGING) {
      editor.command.executePageMode(PageMode.PAGING);
    }
    editor.command.executePrint().finally(() => {
      // 打印完成后恢复原始模式
      if (currentMode !== PageMode.PAGING) {
        editor.command.executePageMode(currentMode);
      }
    });
  }, [editor, pageMode]);

  // 分页/连页切换
  const setPageModeHandler = useCallback(
    (mode: PageMode) => {
      editor?.command.executePageMode(mode);
    },
    [editor],
  );

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  // 重命名：仅保存元数据（走存储适配器 rename），不影响内容 dirty 状态
  const handleRenameConfirm = useCallback(async (name: string) => {
    setRenameOpen(false);
    const { currentDocId, renameDocument } = useDocumentStore.getState();
    if (currentDocId) {
      await renameDocument(currentDocId, name);
    }
  }, []);

  const isPaging = pageMode === PageMode.PAGING;
  const isContinuity = pageMode === PageMode.CONTINUITY;

  const modeBtn = (mode: PageMode, label: string, active: boolean) => (
    <button
      type="button"
      className={`h-6 min-w-6 flex items-center justify-center cursor-pointer mx-0.5 px-1.5 rounded border-0 hover:bg-slate-100 whitespace-nowrap ${
        active ? 'bg-[#e8e9eb] text-[#1f2329]' : 'text-[#646a73]'
      }`}
      onClick={() => setPageModeHandler(mode)}
      title={label}
    >
      <span className="text-[11px]">{label}</span>
    </button>
  );

  // scale 是小数（如 1.0 = 100%），显示为百分比
  const zoomPercent = `${Math.round(scale * 100)}%`;

  return (
    <div className="no-print h-[30px] flex items-center justify-between bg-[#f5f6f7] text-xs text-[#646a73] px-[20px] z-[9]">
      {/* 左侧：文档名 + 目录 + 分页/连页 + 页码 + 字数 */}
      <div className="flex min-w-0 items-center gap-[8px] overflow-hidden whitespace-nowrap">
        <button
          type="button"
          className="flex items-center gap-1 px-1.5 py-0.5 -mx-1.5 rounded border-0 bg-transparent cursor-pointer hover:bg-[#e8e8e8] transition-colors text-[#333] max-w-[200px]"
          onClick={() => setRenameOpen(true)}
          title={t('word.status.renameHint')}
        >
          <Pencil size={11} className="flex-shrink-0 text-[#999]" />
          <span className="truncate">{docTitle}</span>
        </button>
        <button
          type="button"
          className={`${BTN} ${catalogOpen ? 'bg-[#e8e9eb]' : ''}`}
          onClick={toggleCatalog}
          title={t('word.status.catalog')}
        >
          <List size={16} />
        </button>
        <div className="flex items-center">
          {modeBtn(PageMode.PAGING, t('word.status.paging'), isPaging)}
          {modeBtn(PageMode.CONTINUITY, t('word.status.continuous'), isContinuity)}
        </div>
        <span>{t('status.pageOf', { current: currentPage, total: totalPages })}</span>
        <span>{t('status.words', { count: wordCount })}</span>
        {/* 保存状态：dirty 时红色未保存，云端保存成功后灰色已保存 */}
        {isDirty ? (
          <span className="text-[#e02e2e]">● {t('shell.unsaved')}</span>
        ) : (
          <span className="text-[#8f959e]">✓ {t('shell.saved')}</span>
        )}
      </div>

      {/* 右侧：缩放 + 纸张设置 + 全屏 */}
      <div className="flex shrink-0 items-center gap-[4px]">
        <button type="button" className={BTN} onClick={zoomOut} title={t('word.status.zoomOutHint')}>
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          className="w-10 h-6 flex items-center justify-center cursor-pointer text-slate-600 hover:text-blue-600 border-0 bg-transparent p-0"
          onClick={zoomReset}
          title={t('word.status.zoomResetHint')}
        >
          {zoomPercent}
        </button>
        <button type="button" className={BTN} onClick={zoomIn} title={t('word.status.zoomInHint')}>
          <ZoomIn size={16} />
        </button>
        <PaperSizeMenu />
        <PaperDirectionMenu />
        <MarginMenu />
        <button type="button" className={BTN} onClick={handlePrint} title={t('word.status.print')}>
          <Printer size={16} />
        </button>
        <button type="button" className={BTN} onClick={toggleFullscreen} title={t('word.status.fullscreen')}>
          <Fullscreen size={16} />
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => setSettingsOpen(true, 'general')}
          title={t('word.status.settings')}
        >
          <Settings size={16} />
        </button>
      </div>
      {renameOpen && (
        <RenameDialog
          currentName={docTitle}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameOpen(false)}
        />
      )}
    </div>
  );
}
