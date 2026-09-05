// 插入类共享逻辑：图片本地选择、链接弹窗（供工具栏"插入▾"与主菜单复用）
// Task 2.3：已从 TipTap 迁移到 canvas-editor API
import { useRef, useState, useEffect } from 'react';
import type Editor from '@hufe921/canvas-editor';
import { LinkDialog } from './LinkDialog';

/** 图片上传：本地选择文件 → 校验 → dataURL 通过 executeImage 插入 canvas-editor */
export function useImageInsert(editor: Editor | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  // toast 自动 2 秒后消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const open = () => fileInputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (!file.type.startsWith('image/')) {
      setToast('请选择图片文件');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setToast('图片不能超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // canvas-editor executeImage 需要 width/height；未提供时以 300x200 作默认（后续可拖拽缩放）
      editor.command.executeImage({
        value: reader.result as string,
        width: 300,
        height: 200,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const input = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.gif,.webp"
        className="hidden"
        onChange={handleFile}
      />
      {toast && (
        <div className="fixed left-1/2 top-12 z-[10001] -translate-x-1/2 rounded-md bg-red-500 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );

  return { open, input };
}

interface LinkDialogState {
  openInsert: () => void;
  openEdit: () => void;
  /** 渲染在组件里的受控 LinkDialog */
  dialog: React.ReactNode;
}

/** 链接弹窗状态与提交逻辑（插入/编辑两种模式）—— 使用 canvas-editor executeHyperlink */
export function useLinkDialog(editor: Editor | null): LinkDialogState {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'insert' | 'edit'>('insert');
  const [initialText, setInitialText] = useState('');
  const [initialUrl, setInitialUrl] = useState('');

  const openDialog = (m: 'insert' | 'edit') => {
    if (!editor) return;
    // 尝试读取当前选区文本与超链接属性
    const range = editor.command.getRange();
    let text = '';
    let url = '';
    try {
      if (range.startIndex !== range.endIndex) {
        text = editor.command.getRangeText();
      }
      const ctx = editor.command.getRangeContext();
      if (ctx?.startElement?.url) {
        url = ctx.startElement.url;
      }
    } catch {
      // 取不到时保持空
    }
    setInitialText(text);
    setInitialUrl(url);
    setMode(m);
    setOpen(true);
  };

  const handleSubmit = (text: string, url: string) => {
    if (!editor) return;
    const displayText = text.trim() || url;
    // URL scheme 白名单校验：仅允许 http/https/mailto，防止 javascript: 等危险协议
    try {
      const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return;
    } catch {
      return;
    }
    // executeHyperlink payload: Pick<IElement, 'valueList' | 'hyperlinkId' | 'url'>
    editor.command.executeHyperlink({
      valueList: [{ value: displayText }],
      url,
    });
    setOpen(false);
  };

  const handleUnset = () => {
    editor?.command.executeCancelHyperlink();
    setOpen(false);
  };

  const dialog = (
    <LinkDialog
      open={open}
      initialText={initialText}
      initialUrl={initialUrl}
      showUnset={mode === 'edit' && !!initialUrl}
      onClose={() => setOpen(false)}
      onSubmit={handleSubmit}
      onUnset={handleUnset}
    />
  );

  return { openInsert: () => openDialog('insert'), openEdit: () => openDialog('edit'), dialog };
}
