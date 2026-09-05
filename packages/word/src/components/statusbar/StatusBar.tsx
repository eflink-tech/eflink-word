import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Fullscreen,
  List,
  Settings,
  Printer,
  Check,
} from 'lucide-react';
import { PaperSizeIcon, PaperDirectionIcon, PageMarginIcon } from './StatusBarIcons';
import { useUIStore, PAPER_SIZES, MARGIN_PRESETS } from '../../store/uiStore';
import { useClickOutside } from '../../hooks/useClickOutside';
import type Editor from '@hufe921/canvas-editor';
import { PageMode } from '@hufe921/canvas-editor';

interface StatusBarProps {
  editor: Editor | null;
}

const BTN =
  'w-6 h-6 flex items-center justify-center cursor-pointer mx-0.5 rounded hover:bg-slate-100 hover:text-slate-700 border-0 bg-transparent p-0';

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
  const { paperDirection, setPaperDirection } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={BTN} onClick={() => setOpen((v) => !v)} title="纸张方向">
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
          纵向
        </DropdownItem>
        <DropdownItem
          active={paperDirection === 'horizontal'}
          onClick={() => {
            setPaperDirection('horizontal');
            setOpen(false);
          }}
        >
          横向
        </DropdownItem>
      </FooterDropdown>
    </div>
  );
}

/** 纸张类型选择 */
function PaperSizeMenu() {
  const { paperSize, setPaperSize } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={BTN} onClick={() => setOpen((v) => !v)} title="纸张类型">
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
            {p.label}
          </DropdownItem>
        ))}
      </FooterDropdown>
    </div>
  );
}

/** 页边距预设 */
function MarginMenu() {
  const { margin, setMarginPreset, setSettingsOpen } = useUIStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div ref={ref} className="relative">
      <button type="button" className={BTN} onClick={() => setOpen((v) => !v)} title="页边距">
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
            {m.label}
          </DropdownItem>
        ))}
        <DropdownItem
          active={margin.label === '自定义'}
          onClick={() => {
            setSettingsOpen(true, 'margin');
            setOpen(false);
          }}
        >
          自定义…
        </DropdownItem>
      </FooterDropdown>
    </div>
  );
}

// 旧系统样式：30px 高度, 12px 字体, 三段式布局
export function StatusBar({ editor }: StatusBarProps) {
  const { catalogOpen, toggleCatalog, setSettingsOpen } = useUIStore();
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

  const isPaging = pageMode === PageMode.PAGING;
  const isContinuity = pageMode === PageMode.CONTINUITY;

  const modeBtn = (mode: PageMode, label: string, active: boolean) => (
    <button
      type="button"
      className={`w-6 h-6 flex items-center justify-center cursor-pointer mx-0.5 rounded border-0 hover:bg-slate-100 ${
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
      {/* 左侧：目录 + 分页/连页 + 页码 + 字数 */}
      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          className={`${BTN} ${catalogOpen ? 'bg-[#e8e9eb]' : ''}`}
          onClick={toggleCatalog}
          title="目录"
        >
          <List size={16} />
        </button>
        <div className="flex items-center">
          {modeBtn(PageMode.PAGING, '分页', isPaging)}
          {modeBtn(PageMode.CONTINUITY, '连页', isContinuity)}
        </div>
        <span>
          页面：{currentPage}/{totalPages}
        </span>
        <span>字数：{wordCount}</span>
      </div>

      {/* 右侧：缩放 + 纸张设置 + 全屏 */}
      <div className="flex items-center gap-[4px]">
        <button type="button" className={BTN} onClick={zoomOut} title="缩小 (Ctrl+-)">
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          className="w-10 h-6 flex items-center justify-center cursor-pointer text-slate-600 hover:text-blue-600 border-0 bg-transparent p-0"
          onClick={zoomReset}
          title="显示比例（点击复原 Ctrl+0）"
        >
          {zoomPercent}
        </button>
        <button type="button" className={BTN} onClick={zoomIn} title="放大 (Ctrl+=)">
          <ZoomIn size={16} />
        </button>
        <PaperSizeMenu />
        <PaperDirectionMenu />
        <MarginMenu />
        <button type="button" className={BTN} onClick={handlePrint} title="打印">
          <Printer size={16} />
        </button>
        <button type="button" className={BTN} onClick={toggleFullscreen} title="全屏显示">
          <Fullscreen size={16} />
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => setSettingsOpen(true, 'general')}
          title="编辑器设置"
        >
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
}
