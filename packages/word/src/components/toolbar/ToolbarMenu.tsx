// 主菜单模块：级联菜单（对齐微信文档菜单交互——悬停一级分类展开二级，带 ▸ 的项悬停展开三级）
// 分类按 eflink 实际功能定制：文件 / 插入 / 页面 / 视图；仅列真实可用功能
// Task 2.3：已从 TipTap 迁移到 canvas-editor API
import { Fragment, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Calendar,
  Check,
  ChevronRight,
  Code,
  Download,
  Droplet,
  FileDown,
  FilePlus2,
  FileText,
  AlignJustify,
  Eye,
  FileUp,
  ImagePlus,
  Keyboard,
  Layout,
  Link,
  Minus,
  PanelLeft,
  Printer,
  RotateCcw,
  Ruler,
  Save,
  Settings2,
  SplitSquareHorizontal,
  Table,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { PageMode } from '@hufe921/canvas-editor';
import { TextToolButton } from './ToolButton';
import { WordMenuIcon } from '../../components/icons/wordIcons';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDocumentStore } from '../../store/documentStore';
import { useEditorStore } from '../../store/editorStore';
import { useUIStore } from '../../store/uiStore';
import { useImageInsert, useLinkDialog } from './useInsertActions';
import { WatermarkModal } from './WatermarkModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingDialog } from '../../components/common/LoadingDialog';
import { RenameDialog } from '../../components/common/RenameDialog';
import { ShortcutsDialog } from '../../components/common/ShortcutsDialog';
import { formatDateInsert, type DateInsertFormat } from '../../core/utils/dateInsert';
import { exportEfword, exportPdf, importEfword } from '../../core/utils/exportImport';
/** 6 种分割线样式（对齐旧系统 data-separator 值） */
const HR_SEPARATORS: { label: string; value: string }[] = [
  { label: '实线', value: '0,0' },
  { label: '虚线', value: '1,1' },
  { label: '粗虚线', value: '3,1' },
  { label: '点线', value: '4,4' },
  { label: '双实线', value: '7,3,3,3' },
  { label: '粗实线', value: '6,2,2,2,2,2' },
];

interface MenuLeaf {
  key: string;
  label: string;
  icon?: LucideIcon;
  shortcut?: string;
  /** 开关型菜单项：选中时右侧显示 ✓ */
  checked?: boolean;
  disabled?: boolean;
  action?: () => void;
  children?: MenuLeaf[];
}

interface MenuCategory {
  key: string;
  label: string;
  icon: LucideIcon;
  /** 分组之间渲染分隔线 */
  groups: MenuLeaf[][];
  /** 叶子菜单项（无子菜单时直接点击触发） */
  leaf?: MenuLeaf;
}

interface ToolbarMenuProps {
  editor: Editor | null;
}

const iconClass = 'shrink-0 text-[#51565f]';

/** 把 HR_SEPARATORS 中的 "a,b,c" 字符串解析为 canvas-editor 所需的 dashArray: number[] */
function parseDashArray(s: string): number[] {
  return s.split(',').map((n) => Number(n)).filter((n) => Number.isFinite(n));
}

export function ToolbarMenu({ editor }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [confirmNewDoc, setConfirmNewDoc] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  useClickOutside(rootRef, closeAll, open);

  const { open: openImagePicker, input: imageInput } = useImageInsert(editor);
  const linkDialog = useLinkDialog(editor);
  const {
    catalogOpen,
    toggleCatalog,
    viewMode,
    setViewMode,
    zoomIn,
    zoomOut,
    zoomReset,
    watermark,
    setWatermark,
    setSettingsOpen,
  } = useUIStore();
  const currentDocument = useDocumentStore((s) => s.currentDocument);

  function closeAll() {
    setOpen(false);
    setActiveCat(null);
    setOpenSub(null);
  }

  // Escape 关闭整组菜单
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const createNew = () => {
    setConfirmNewDoc(true);
  };

  const handleConfirmNewDoc = async () => {
    setConfirmNewDoc(false);
    // 新建并打开；文档 id 变化经 documentStore 的监听器通知宿主（WordEditor 注入 props.onDocIdChange）
    await useDocumentStore.getState().createAndOpenDocument('未命名文档');
  };

  const openRenameDialog = () => {
    closeAll();
    setRenameOpen(true);
  };

  const openShortcutsDialog = () => {
    closeAll();
    setShortcutsOpen(true);
  };

  const handleRenameConfirm = async (name: string) => {
    setRenameOpen(false);
    const { currentDocId } = useDocumentStore.getState();
    if (currentDocId) {
      await useDocumentStore.getState().renameDocument(currentDocId, name);
    }
  };

  const saveNow = () => {
    void useEditorStore.getState().save();
  };

  const getDocTitle = () => currentDocument?.title?.trim() || '未命名文档';

  const exportEfwordFile = async () => {
    if (!editor) return;
    try {
      await exportEfword(editor, getDocTitle());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('导出文档失败:', err);
    }
  };

  const exportPdfFile = async () => {
    if (!editor || pdfExporting) return;
    closeAll();
    flushSync(() => setPdfExporting(true));
    // 先让 loading 遮罩完成绘制，再执行耗时的 canvas 渲染
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      await exportPdf(editor, getDocTitle());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('导出 PDF 失败:', err);
    } finally {
      setPdfExporting(false);
    }
  };

  const triggerImport = () => {
    if (importInputRef.current) {
      importInputRef.current.value = '';
      importInputRef.current.click();
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      await importEfword(editor, file);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('导入失败:', err);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const insertDate = (format: DateInsertFormat) => {
    if (!editor) return;
    const text = formatDateInsert(new Date(), format);
    editor.command.executeInsertElementList([{ value: text }]);
  };

  const openWatermarkModal = () => {
    closeAll();
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

  const categories: MenuCategory[] = [
    {
      key: 'file',
      label: '文件',
      icon: FileText,
      groups: [
        [
          { key: 'new', label: '新建文档', icon: FilePlus2, shortcut: 'Ctrl N', action: createNew },
          { key: 'rename', label: '修改文档名称', icon: FileText, action: openRenameDialog },
          {
            key: 'export-efword',
            label: '导出文档 (.efword)',
            icon: Download,
            action: exportEfwordFile,
          },
          {
            key: 'export-pdf',
            label: '导出 PDF',
            icon: FileDown,
            action: exportPdfFile,
          },
          {
            key: 'import',
            label: '导入文档 (.efword)',
            icon: FileUp,
            action: triggerImport,
          },
          {
            key: 'save',
            label: '保存到浏览器',
            icon: Save,
            shortcut: 'Ctrl S',
            action: saveNow,
          },
          {
            key: 'print',
            label: '打印',
            icon: Printer,
            shortcut: 'Ctrl P',
            action: () => {
              if (!editor) return;
              // 打印预览始终以分页模式显示，打印后恢复原始模式
              const currentMode = editor.command.getOptions().pageMode;
              if (currentMode !== PageMode.PAGING) {
                editor.command.executePageMode(PageMode.PAGING);
              }
              editor.command.executePrint().finally(() => {
                if (currentMode !== PageMode.PAGING) {
                  editor.command.executePageMode(currentMode);
                }
              });
            },
          },
        ],
      ],
    },
    {
      key: 'insert',
      label: '插入',
      icon: ImagePlus,
      groups: [
        [
          {
            key: 'table',
            label: '表格',
            icon: Table,
            action: () => editor?.command.executeInsertTable(3, 3),
          },
          {
            key: 'image',
            label: '图片（本地上传）',
            icon: ImagePlus,
            action: openImagePicker,
          },
          { key: 'link', label: '链接', icon: Link, action: linkDialog.openInsert },
        ],
        [
          {
            key: 'date',
            label: '日期',
            icon: Calendar,
            children: [
              {
                key: 'date-d',
                label: 'yyyy-MM-dd',
                action: () => insertDate('date'),
              },
              {
                key: 'date-dt',
                label: 'yyyy-MM-dd HH:mm:ss',
                action: () => insertDate('datetime'),
              },
            ],
          },
          {
            key: 'hr',
            label: '分隔线样式',
            icon: Minus,
            children: HR_SEPARATORS.map(({ label, value }) => ({
              key: `hr-${value}`,
              label,
              action: () => editor?.command.executeSeparator(parseDashArray(value)),
            })),
          },
          {
            key: 'watermark',
            label: '水印',
            icon: Droplet,
            children: [
              {
                key: 'wm-add',
                label: watermark ? '修改水印' : '添加水印',
                action: openWatermarkModal,
              },
              ...(watermark
                ? [
                    {
                      key: 'wm-remove',
                      label: '删除水印',
                      action: () => {
                        editor?.command.executeDeleteWatermark();
                        setWatermark(null);
                      },
                    },
                  ]
                : []),
            ],
          },
        ],
        [
          // canvas-editor 无原生代码块，禁用占位（spec 偏差）
          {
            key: 'code',
            label: '代码块',
            icon: Code,
            disabled: true,
          },
          {
            key: 'page-break',
            label: '分页符',
            icon: SplitSquareHorizontal,
            action: () => editor?.command.executePageBreak(),
          },
        ],
      ],
    },
    {
      key: 'page',
      label: '页面',
      icon: Layout,
      groups: [
        [
          {
            key: 'page-settings',
            label: '页面设置…',
            icon: Settings2,
            action: () => setSettingsOpen(true, 'general'),
          },
          {
            key: 'margin-settings',
            label: '页边距…',
            icon: Ruler,
            action: () => setSettingsOpen(true, 'margin'),
          },
        ],
        [
          {
            key: 'mode-page',
            label: '页面视图',
            icon: FileText,
            checked: viewMode === 'page',
            action: () => setViewMode('page'),
          },
          {
            key: 'mode-continuous',
            label: '连续视图',
            icon: AlignJustify,
            checked: viewMode === 'continuous',
            action: () => setViewMode('continuous'),
          },
        ],
      ],
    },
    {
      key: 'view',
      label: '视图',
      icon: Eye,
      groups: [
        [
          {
            key: 'catalog',
            label: '目录',
            icon: PanelLeft,
            checked: catalogOpen,
            action: toggleCatalog,
          },
        ],
        [
          { key: 'zoom-in', label: '放大', icon: ZoomIn, shortcut: 'Ctrl =', action: zoomIn },
          { key: 'zoom-out', label: '缩小', icon: ZoomOut, shortcut: 'Ctrl -', action: zoomOut },
          { key: 'zoom-reset', label: '重置缩放', icon: RotateCcw, shortcut: 'Ctrl 0', action: zoomReset },
        ],
      ],
    },
    {
      key: 'shortcuts',
      label: '快捷键',
      icon: Keyboard,
      /** 快捷键菜单是叶子菜单：点击直接打开对话框，不需要子菜单 */
      groups: [],
      /** 直接作为叶子项处理 */
      leaf: {
        key: 'shortcuts-list',
        label: '查看全部快捷键',
        icon: Code,
        shortcut: 'Ctrl /',
        action: openShortcutsDialog,
      },
    },
  ];

  const renderLeaf = (leaf: MenuLeaf) => (
    <div
      key={leaf.key}
      className="relative"
      onMouseEnter={leaf.children ? () => setOpenSub(leaf.key) : undefined}
    >
      <button
        type="button"
        disabled={leaf.disabled}
        onClick={() => {
          if (leaf.children) {
            setOpenSub((v) => (v === leaf.key ? null : leaf.key));
            return;
          }
          leaf.action?.();
          closeAll();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-[7px] text-left text-[13px] text-[#1f2329] transition-colors hover:bg-[#f2f3f4] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {leaf.icon ? <leaf.icon size={16} className={iconClass} /> : <span className="w-4" />}
        <span className="min-w-0 flex-1 truncate">{leaf.label}</span>
        {leaf.checked && <Check size={13} className="shrink-0 text-[#1f2329]" />}
        {leaf.shortcut && (
          <span className="shrink-0 text-xs text-[#8f959e]">{leaf.shortcut}</span>
        )}
        {leaf.children && <ChevronRight size={12} className="shrink-0 text-[#8f959e]" />}
      </button>
      {leaf.children && openSub === leaf.key && (
        <div className="absolute left-full top-0 z-[10000] ml-0.5 w-[176px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {leaf.children.map((child) => renderLeaf(child))}
        </div>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <TextToolButton
        icon={WordMenuIcon}
        label="菜单"
        caret
        onClick={() => {
          setOpen((v) => !v);
          setActiveCat(null);
          setOpenSub(null);
        }}
      />

      {open && (
        <div className="absolute top-full left-0 z-[9999] mt-1 w-[132px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          {categories.map((cat) => (
            <div
              key={cat.key}
              className="relative"
              onMouseEnter={() => {
                // 叶子分类（如快捷键）不展开子菜单
                if (!cat.leaf) {
                  setActiveCat(cat.key);
                  setOpenSub(null);
                }
              }}
            >
              <button
                type="button"
                onClick={() => {
                  // 叶子分类直接触发
                  if (cat.leaf) {
                    cat.leaf.action?.();
                    closeAll();
                    return;
                  }
                  setActiveCat(cat.key);
                  setOpenSub(null);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors ${
                  activeCat === cat.key
                    ? 'bg-[#f2f3f4] text-[#1f2329]'
                    : 'text-[#1f2329] hover:bg-[#f2f3f4]'
                } ${cat.leaf ? 'cursor-pointer' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <cat.icon size={16} className={iconClass} />
                  {cat.label}
                </span>
                {!cat.leaf && <ChevronRight size={12} className="shrink-0 text-[#8f959e]" />}
              </button>

              {activeCat === cat.key && (
                <div className="absolute left-full top-0 z-[9999] ml-0.5 w-[224px] rounded-lg border border-black/[0.08] bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                  {cat.groups.map((group, gi) => (
                    <Fragment key={gi}>
                      {gi > 0 && <div className="my-1 h-px bg-black/[0.05]" />}
                      {group.map((leaf) => renderLeaf(leaf))}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {imageInput}
      {linkDialog.dialog}
      <input
        ref={importInputRef}
        type="file"
        accept=".efword,application/json,.json"
        className="hidden"
        onChange={handleImportChange}
      />
      {watermarkOpen && (
        <WatermarkModal
          initialValue={watermark}
          onSubmit={handleWatermarkSubmit}
          onRemove={handleWatermarkRemove}
          onClose={() => setWatermarkOpen(false)}
        />
      )}
      {confirmNewDoc && (
        <ConfirmDialog
          title="新建文档"
          message="新建文档将清空当前内容，请确保已经下载备份文档！"
          onConfirm={handleConfirmNewDoc}
          onCancel={() => setConfirmNewDoc(false)}
        />
      )}
      {renameOpen && (
        <RenameDialog
          currentName={currentDocument?.title ?? '未命名文档'}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameOpen(false)}
        />
      )}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {pdfExporting && <LoadingDialog message="正在导出 PDF，请稍候..." />}
    </div>
  );
}
