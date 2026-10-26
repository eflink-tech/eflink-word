// Word 主菜单：横向菜单栏（对齐统一后的 office-kit 顶栏），保留原汉堡菜单的全部动作与弹窗。
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  AlignJustify,
  Calendar,
  Code,
  Download,
  Droplet,
  FileDown,
  FileInput,
  FileOutput,
  FilePlus2,
  FileText,
  FileUp,
  ImageDown,
  ImagePlus,
  Keyboard,
  Link as LinkIcon,
  Minus,
  MousePointer2,
  PanelLeft,
  Pencil,
  Printer,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Search,
  Settings2,
  Sparkles,
  SplitSquareHorizontal,
  Table,
  Undo2,
  Unlink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { PageMode } from '@hufe921/canvas-editor';
import {
  OfficeHeader,
  resolveErrorMessage,
  useI18n,
  type OfficeMenu,
} from '@eflink-tech/office-kit';
import { useDocumentStore } from '../../store/documentStore';
import { useEditorStore } from '../../store/editorStore';
import { useUIStore } from '../../store/uiStore';
import { getEditorBackHref } from '../../core/chrome';
import { useImageInsert, useLinkDialog } from '../toolbar/useInsertActions';
import { WatermarkModal } from '../toolbar/WatermarkModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ErrorDialog } from '../common/ErrorDialog';
import { LoadingDialog } from '../common/LoadingDialog';
import { RenameDialog } from '../common/RenameDialog';
import { ShortcutsDialog } from '../common/ShortcutsDialog';
import { formatDateInsert, type DateInsertFormat } from '../../core/utils/dateInsert';
import { exportEfword, exportImage, exportPdf, importEfword } from '../../core/utils/exportImport';

const ICON = 16;

function menuIcon(node: React.ReactNode) {
  return node;
}

interface WordMenuBarProps {
  editor: Editor | null;
  brand?: { logo?: string; name: string } | false;
  showMenus?: boolean;
  actions?: React.ReactNode;
}

export function WordMenuBar({ editor, brand = false, showMenus = true, actions }: WordMenuBarProps) {
  const { t } = useI18n();
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
    aiPanelOpen,
    setSearchPanelOpen,
  } = useUIStore();
  const rangeStyle = useEditorStore((state) => state.rangeStyle);
  const currentDocument = useDocumentStore((state) => state.currentDocument);

  const [watermarkOpen, setWatermarkOpen] = useState(false);
  const [confirmNewDoc, setConfirmNewDoc] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [imageExporting, setImageExporting] = useState(false);
  const [docxExporting, setDocxExporting] = useState(false);
  const [docxImporting, setDocxImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const docxImportInputRef = useRef<HTMLInputElement>(null);

  const { open: openImagePicker, input: imageInput } = useImageInsert(editor);
  const linkDialog = useLinkDialog(editor);

  const getDocTitle = () => currentDocument?.title?.trim() || t('word.status.unnamed');

  const createNew = () => setConfirmNewDoc(true);

  const handleConfirmNewDoc = async () => {
    setConfirmNewDoc(false);
    await useDocumentStore.getState().createAndOpenDocument(t('word.status.unnamed'));
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

  const exportEfwordFile = async () => {
    if (!editor) return;
    try {
      await exportEfword(editor, getDocTitle());
    } catch (err) {
      console.error('导出文档失败:', err);
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.efwExport'));
    }
  };

  const exportPdfFile = async () => {
    if (!editor || pdfExporting) return;
    flushSync(() => setPdfExporting(true));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      await exportPdf(editor, getDocTitle());
    } catch (err) {
      console.error('导出 PDF 失败:', err);
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.pdfExport'));
    } finally {
      setPdfExporting(false);
    }
  };

  const exportImageFile = async () => {
    if (!editor || imageExporting) return;
    flushSync(() => setImageExporting(true));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      await exportImage(editor, getDocTitle());
    } catch (err) {
      console.error('导出图片失败:', err);
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.imageExport'));
    } finally {
      setImageExporting(false);
    }
  };

  const exportDocxFile = async () => {
    if (!editor || docxExporting) return;
    flushSync(() => setDocxExporting(true));
    try {
      const { exportDocx } = await import('../../core/docx');
      await exportDocx(editor, getDocTitle());
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.exportDocx'));
    } finally {
      setDocxExporting(false);
    }
  };

  const triggerDocxImport = () => {
    if (docxImportInputRef.current) {
      docxImportInputRef.current.value = '';
      docxImportInputRef.current.click();
    }
  };

  const handleDocxImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    flushSync(() => setDocxImporting(true));
    try {
      const { importDocx } = await import('../../core/docx');
      await importDocx(editor, file);
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.importDocx'));
    } finally {
      setDocxImporting(false);
      if (docxImportInputRef.current) docxImportInputRef.current.value = '';
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
      console.error('导入失败:', err);
      setErrorMessage(resolveErrorMessage(err, t, 'word.error.efwImport'));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const insertDate = (format: DateInsertFormat) => {
    if (!editor) return;
    editor.command.executeInsertElementList([{ value: formatDateInsert(new Date(), format) }]);
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

  const print = () => {
    if (!editor) return;
    const currentMode = editor.command.getOptions().pageMode;
    if (currentMode !== PageMode.PAGING) {
      editor.command.executePageMode(PageMode.PAGING);
    }
    editor.command.executePrint().finally(() => {
      if (currentMode !== PageMode.PAGING) {
        editor.command.executePageMode(currentMode);
      }
    });
  };

  const canUndo = rangeStyle?.undo ?? false;
  const canRedo = rangeStyle?.redo ?? false;

  const fileMenu: OfficeMenu = {
    key: 'file',
    label: t('shell.menu.file'),
    items: [
      [
        {
          key: 'new',
          label: t('word.menu.newDoc'),
          icon: menuIcon(<FilePlus2 size={ICON} />),
          shortcut: 'Ctrl N',
          onSelect: createNew,
        },
        {
          key: 'rename',
          label: t('word.menu.renameDoc'),
          icon: menuIcon(<Pencil size={ICON} />),
          onSelect: () => setRenameOpen(true),
        },
      ],
      [
        {
          key: 'import-docx',
          label: t('word.menu.importDocx'),
          icon: menuIcon(<FileInput size={ICON} />),
          onSelect: triggerDocxImport,
        },
        {
          key: 'import-efword',
          label: t('word.menu.importData'),
          icon: menuIcon(<FileUp size={ICON} />),
          onSelect: triggerImport,
        },
      ],
      [
        {
          key: 'export-docx',
          label: t('word.menu.exportDocx'),
          icon: menuIcon(<FileOutput size={ICON} />),
          onSelect: exportDocxFile,
        },
        {
          key: 'export-efword',
          label: t('word.menu.exportData'),
          icon: menuIcon(<Download size={ICON} />),
          onSelect: exportEfwordFile,
        },
        {
          key: 'export-pdf',
          label: t('action.exportPdf'),
          icon: menuIcon(<FileDown size={ICON} />),
          onSelect: exportPdfFile,
        },
        {
          key: 'export-image',
          label: t('action.exportImage'),
          icon: menuIcon(<ImageDown size={ICON} />),
          onSelect: exportImageFile,
        },
      ],
      [
        {
          key: 'save',
          label: t('action.saveToBrowser'),
          icon: menuIcon(<Save size={ICON} />),
          shortcut: 'Ctrl S',
          onSelect: saveNow,
        },
        {
          key: 'print',
          label: t('action.print'),
          icon: menuIcon(<Printer size={ICON} />),
          shortcut: 'Ctrl P',
          onSelect: print,
        },
      ],
    ],
  };

  const editMenu: OfficeMenu = {
    key: 'edit',
    label: t('shell.menu.edit'),
    items: [
      [
        {
          key: 'undo',
          label: t('action.undo'),
          icon: menuIcon(<Undo2 size={ICON} />),
          shortcut: 'Ctrl Z',
          disabled: !canUndo,
          onSelect: () => editor?.command.executeUndo(),
        },
        {
          key: 'redo',
          label: t('action.redo'),
          icon: menuIcon(<Redo2 size={ICON} />),
          shortcut: 'Ctrl Y',
          disabled: !canRedo,
          onSelect: () => editor?.command.executeRedo(),
        },
      ],
      [
        {
          key: 'select-all',
          label: t('action.selectAll'),
          icon: menuIcon(<MousePointer2 size={ICON} />),
          shortcut: 'Ctrl A',
          onSelect: () => editor?.command.executeSelectAll(),
        },
        {
          key: 'clear-format',
          label: t('action.clearFormat'),
          icon: menuIcon(<Sparkles size={ICON} />),
          onSelect: () => editor?.command.executeFormat(),
        },
      ],
      [
        {
          key: 'find',
          label: t('word.menu.edit.find'),
          icon: menuIcon(<Search size={ICON} />),
          shortcut: 'Ctrl F',
          onSelect: () => setSearchPanelOpen(true),
        },
      ],
    ],
  };

  const insertMenu: OfficeMenu = {
    key: 'insert',
    label: t('shell.menu.insert'),
    items: [
      [
        {
          key: 'table',
          label: t('word.insert.table'),
          icon: menuIcon(<Table size={ICON} />),
          onSelect: () => editor?.command.executeInsertTable(3, 3),
        },
        {
          key: 'image',
          label: t('word.insert.imageUpload'),
          icon: menuIcon(<ImagePlus size={ICON} />),
          onSelect: openImagePicker,
        },
        {
          key: 'link',
          label: t('word.insert.link'),
          icon: menuIcon(<LinkIcon size={ICON} />),
          onSelect: linkDialog.openInsert,
        },
        ...(linkDialogHasLink(editor)
          ? [
              {
                key: 'edit-link',
                label: t('word.insert.editLink'),
                icon: menuIcon(<Pencil size={ICON} />),
                onSelect: linkDialog.openEdit,
              },
              {
                key: 'remove-link',
                label: t('word.insert.removeLink'),
                icon: menuIcon(<Unlink size={ICON} />),
                onSelect: () => editor?.command.executeCancelHyperlink(),
              },
            ]
          : []),
      ],
      [
        {
          key: 'date',
          label: t('word.insert.date'),
          icon: menuIcon(<Calendar size={ICON} />),
          children: [
            [
              { key: 'date-d', label: 'yyyy-MM-dd', onSelect: () => insertDate('date') },
              {
                key: 'date-dt',
                label: 'yyyy-MM-dd HH:mm:ss',
                onSelect: () => insertDate('datetime'),
              },
            ],
          ],
        },
        {
          key: 'separator',
          label: t('word.insert.separator'),
          icon: menuIcon(<Minus size={ICON} />),
          children: [
            [
              { key: 'hr-solid', label: t('word.insert.hrSolid'), onSelect: () => editor?.command.executeSeparator([0, 0]) },
              { key: 'hr-dashed', label: t('word.insert.hrDashed'), onSelect: () => editor?.command.executeSeparator([1, 1]) },
              { key: 'hr-thick-dashed', label: t('word.insert.hrThickDashed'), onSelect: () => editor?.command.executeSeparator([3, 1]) },
              { key: 'hr-dotted', label: t('word.insert.hrDotted'), onSelect: () => editor?.command.executeSeparator([4, 4]) },
              { key: 'hr-double', label: t('word.insert.hrDouble'), onSelect: () => editor?.command.executeSeparator([7, 3, 3, 3]) },
              { key: 'hr-thick', label: t('word.insert.hrThick'), onSelect: () => editor?.command.executeSeparator([6, 2, 2, 2, 2, 2]) },
            ],
          ],
        },
        {
          key: 'watermark',
          label: t('word.insert.watermarkAdd'),
          icon: menuIcon(<Droplet size={ICON} />),
          children: [
            [
              {
                key: 'watermark-set',
                label: watermark ? t('word.insert.watermarkEdit') : t('word.insert.watermarkAdd'),
                onSelect: () => setWatermarkOpen(true),
              },
              ...(watermark
                ? [
                    {
                      key: 'watermark-remove',
                      label: t('word.insert.watermarkRemove'),
                      danger: true,
                      onSelect: handleWatermarkRemove,
                    },
                  ]
                : []),
            ],
          ],
        },
      ],
      [
        {
          key: 'code-block',
          label: t('word.insert.codeBlock'),
          icon: menuIcon(<Code size={ICON} />),
          disabled: true,
        },
        {
          key: 'page-break',
          label: t('word.insert.pageBreak'),
          icon: menuIcon(<SplitSquareHorizontal size={ICON} />),
          onSelect: () => editor?.command.executePageBreak(),
        },
      ],
    ],
  };

  const pageMenu: OfficeMenu = {
    key: 'page',
    label: t('shell.menu.page'),
    items: [
      [
        {
          key: 'page-settings',
          label: t('word.menu.page.settings'),
          icon: menuIcon(<Settings2 size={ICON} />),
          onSelect: () => setSettingsOpen(true, 'general'),
        },
        {
          key: 'margin-settings',
          label: t('word.menu.page.margins'),
          icon: menuIcon(<Ruler size={ICON} />),
          onSelect: () => setSettingsOpen(true, 'margin'),
        },
      ],
    ],
  };

  const viewMenu: OfficeMenu = {
    key: 'view',
    label: t('shell.menu.view'),
    items: [
      [
        {
          key: 'catalog',
          label: t('word.menu.view.catalog'),
          icon: menuIcon(<PanelLeft size={ICON} />),
          checked: catalogOpen,
          onSelect: toggleCatalog,
        },
        {
          key: 'page-view',
          label: t('word.menu.view.pageView'),
          icon: menuIcon(<FileText size={ICON} />),
          checked: viewMode === 'page',
          onSelect: () => setViewMode('page'),
        },
        {
          key: 'continuous-view',
          label: t('word.menu.view.continuousView'),
          icon: menuIcon(<AlignJustify size={ICON} />),
          checked: viewMode === 'continuous',
          onSelect: () => setViewMode('continuous'),
        },
      ],
      [
        {
          key: 'zoom-in',
          label: t('action.zoomIn'),
          icon: menuIcon(<ZoomIn size={ICON} />),
          shortcut: 'Ctrl =',
          onSelect: zoomIn,
        },
        {
          key: 'zoom-out',
          label: t('action.zoomOut'),
          icon: menuIcon(<ZoomOut size={ICON} />),
          shortcut: 'Ctrl -',
          onSelect: zoomOut,
        },
        {
          key: 'zoom-reset',
          label: t('action.zoomReset'),
          icon: menuIcon(<RotateCcw size={ICON} />),
          shortcut: 'Ctrl 0',
          onSelect: zoomReset,
        },
      ],
      [
        {
          key: 'ai',
          label: t('word.menu.view.ai'),
          icon: menuIcon(<Sparkles size={ICON} />),
          checked: aiPanelOpen,
          onSelect: () => useUIStore.getState().toggleAIPanel(),
        },
      ],
    ],
  };

  const helpMenu: OfficeMenu = {
    key: 'help',
    label: t('shell.menu.help'),
    items: [
      [
        {
          key: 'shortcuts',
          label: t('word.menu.help.shortcuts'),
          icon: menuIcon(<Keyboard size={ICON} />),
          shortcut: 'Ctrl /',
          onSelect: () => setShortcutsOpen(true),
        },
      ],
    ],
  };

  const menus: OfficeMenu[] = [fileMenu, editMenu, insertMenu, pageMenu, viewMenu, helpMenu];

  return (
    <>
      <OfficeHeader
        brand={brand}
        backHref={getEditorBackHref()}
        menus={showMenus ? menus : []}
        actions={actions}
      />

      {imageInput}
      {linkDialog.dialog}
      <input
        ref={importInputRef}
        type="file"
        accept=".efw.json,.efword,application/json,.json"
        className="hidden"
        onChange={handleImportChange}
      />
      <input
        ref={docxImportInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleDocxImportChange}
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
          title={t('word.confirm.newDocTitle')}
          message={t('word.confirm.newDocMessage')}
          onConfirm={handleConfirmNewDoc}
          onCancel={() => setConfirmNewDoc(false)}
        />
      )}
      {renameOpen && (
        <RenameDialog
          currentName={getDocTitle()}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameOpen(false)}
        />
      )}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {pdfExporting && <LoadingDialog message={t('word.loading.exportPdf')} />}
      {imageExporting && <LoadingDialog message={t('word.loading.exportImage')} />}
      {docxExporting && <LoadingDialog message={t('word.loading.exportDocx')} />}
      {docxImporting && <LoadingDialog message={t('word.loading.importDocx')} />}
      {errorMessage && (
        <ErrorDialog title={t('word.error.title')} message={errorMessage} onClose={() => setErrorMessage(null)} />
      )}
    </>
  );
}

/** 光标在超链接内时才显示「编辑/取消链接」 */
function linkDialogHasLink(editor: Editor | null): boolean {
  if (!editor) return false;
  try {
    const ctx = editor.command.getRangeContext();
    return Boolean(ctx?.startElement?.url);
  } catch {
    return false;
  }
}
