// 导出弹窗：与 PPTX 相同交互——一个「导出」入口，弹窗内选择文件类型
// - 导出期间按钮显示 spinner +「导出中」，并禁用其余选项
// - 图片/PDF 体积大、耗时长，先让 loading 完成一次绘制再开始重渲染
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { resolveErrorMessage, useI18n } from '@eflink-tech/office-kit';
import { exportEfword, exportImage, exportPdf } from '../../core/utils/exportImport';

interface ExportDialogProps {
  editor: Editor;
  title: string;
  onClose: () => void;
}

type ExportKey = 'docx' | 'pdf' | 'image' | 'data';

const FALLBACK_ERROR: Record<ExportKey, string> = {
  docx: 'word.error.exportDocx',
  pdf: 'word.error.pdfExport',
  image: 'word.error.imageExport',
  data: 'word.error.efwExport',
};

// 双 rAF 等 loading 真正绘制一帧后再开始重导出，否则同步绘制会阻塞首帧
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function ExportDialog({ editor, title, onClose }: ExportDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const run = async (key: ExportKey, fn: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    // 同步提交 loading 状态，保证重任务开始前用户先看到 spinner
    flushSync(() => setBusy(key));
    await nextPaint();
    try {
      await fn();
    } catch (err) {
      setError(resolveErrorMessage(err, t, FALLBACK_ERROR[key]));
    } finally {
      setBusy(null);
    }
  };

  const options: Array<{ key: ExportKey; title: string; desc: string; run: () => Promise<void> }> = [
    {
      key: 'docx',
      title: t('word.export.docx'),
      desc: t('word.export.docxDesc'),
      run: async () => {
        const { exportDocx } = await import('../../core/docx');
        await exportDocx(editor, title);
      },
    },
    {
      key: 'pdf',
      title: t('word.export.pdf'),
      desc: t('word.export.pdfDesc'),
      run: () => exportPdf(editor, title),
    },
    {
      key: 'image',
      title: t('word.export.image'),
      desc: t('word.export.imageDesc'),
      run: () => exportImage(editor, title),
    },
    {
      key: 'data',
      title: t('word.export.data'),
      desc: t('word.export.dataDesc'),
      run: () => exportEfword(editor, title),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('word.export.title')}
        className="max-h-[85vh] overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{ width: 520 }}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <span className="text-sm font-semibold text-gray-700">{t('word.export.title')}</span>
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
        <div className="max-h-[75vh] overflow-y-auto p-5">
          <div className="space-y-2.5">
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!!busy}
                onClick={() => void run(option.key, option.run)}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  {busy === option.key ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin" />
                      {t('word.export.busy')}
                    </span>
                  ) : (
                    option.title
                  )}
                </div>
                <div className="mt-0.5 text-xs text-gray-400">{option.desc}</div>
              </button>
            ))}
            {error && <div className="text-xs text-red-500">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
