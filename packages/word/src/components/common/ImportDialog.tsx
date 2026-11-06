// 导入弹窗：与 PPTX 相同交互——选择文件 → 预览 → 确认导入
// - .docx：先高保真预览（离屏打印渲染成逐页图片），确认后覆盖当前文档
// - .json（.efw.json）：工程文件原样还原，直接导入
import { useEffect, useState, type ReactNode } from 'react';
import type Editor from '@hufe921/canvas-editor';
import { resolveErrorMessage, useI18n } from '@eflink-tech/office-kit';
import { applyParsedDocx, parseDocx, renderDocxPreviewImages } from '../../core/docx';
import type { ParsedDocx } from '../../core/docx';
import { importEfword } from '../../core/utils/exportImport';
import { useUIStore } from '../../store/uiStore';

interface ImportDialogProps {
  editor: Editor;
  onClose: () => void;
}

interface DocxPreview {
  parsed: ParsedDocx;
  pages: string[];
}

type Busy = null | 'preview' | 'import';

export function ImportDialog({ editor, onClose }: ImportDialogProps) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<DocxPreview | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const handleDocxConfirm = async () => {
    if (!preview || busy) return;
    setBusy('import');
    setError(null);
    try {
      const zone = await applyParsedDocx(editor, preview.parsed);
      // 页眉/页脚/页码跟随导入的文档：content 置空 = 显示文档自带的页眉/页脚
      const { setHeaderConfig, setFooterConfig, setPageNumberConfig } = useUIStore.getState();
      setHeaderConfig({ enabled: !!zone?.hasHeader, content: '' });
      setFooterConfig({ enabled: !!zone?.hasFooter, content: '' });
      setPageNumberConfig(
        zone?.pageNumber
          ? { enabled: true, ...zone.pageNumber }
          : { enabled: false },
      );
      onClose();
    } catch (err) {
      setBusy(null);
      setError(resolveErrorMessage(err, t, 'word.error.importDocx'));
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.json')) {
      setBusy('import');
      try {
        await importEfword(editor, file);
        onClose();
      } catch (err) {
        setBusy(null);
        setError(resolveErrorMessage(err, t, 'word.error.efwImport'));
      }
      return;
    }
    if (!lower.endsWith('.docx')) {
      setError(t('word.import.chooseFile'));
      return;
    }
    setBusy('preview');
    try {
      const parsed = await parseDocx(file);
      const pages = await renderDocxPreviewImages(parsed);
      setPreview({ parsed, pages });
    } catch (err) {
      setError(resolveErrorMessage(err, t, 'word.error.importDocx'));
    } finally {
      setBusy(null);
    }
  };

  const shell = (title: string, width: number, body: ReactNode) => (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{ width }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <span className="text-sm font-semibold text-gray-700">{title}</span>
          <button
            type="button"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
            aria-label={t('action.close')}
            title={t('action.close')}
            disabled={!!busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{body}</div>
      </div>
    </div>
  );

  if (preview) {
    return shell(
      t('word.import.previewTitle'),
      760,
      <>
        <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-auto">
          {preview.pages.map((src, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              <img src={src} alt="" className="block w-full" />
              <div className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {t('word.import.pageCount', { count: preview.pages.length })}
        </div>
        {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={!!busy}
            onClick={() => {
              setPreview(null);
              setError(null);
            }}
          >
            {t('word.import.back')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={!!busy}
            onClick={() => void handleDocxConfirm()}
          >
            {busy === 'import' ? t('word.import.importing') : t('word.import.confirm')}
          </button>
        </div>
      </>,
    );
  }

  return shell(
    t('word.import.title'),
    520,
    <>
      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 text-center hover:border-blue-500">
        <input
          type="file"
          accept=".docx,.json"
          className="hidden disabled:opacity-50"
          disabled={!!busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
        <div className="text-sm text-gray-600">
          {busy === 'preview' ? t('word.import.previewing') : t('word.import.choose')}
        </div>
        <div className="mt-1 text-xs text-gray-400">{t('word.import.support')}</div>
        <div className="mt-2 text-[11px] text-gray-400">{t('word.import.previewNote')}</div>
        <div className="mt-2 text-[11px] text-gray-400">{t('word.import.limitNote')}</div>
      </label>
      {error && <div className="mt-3 text-xs text-red-500">{error}</div>}
    </>,
  );
}
