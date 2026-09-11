import type { CanvasEditorData } from '../types/document';

/**
 * 本地草稿兜底：内容变化后先落 localStorage，云端保存（手动 ⌘S/Ctrl+S）成功后清除。
 * key 约定：eflink:draft:word:<docId>，宿主离页拦截可据此识别/丢弃草稿。
 */
function draftKey(docId: string): string {
  return `eflink:draft:word:${docId}`;
}

/** 写入本地草稿；失败（隐私模式/容量不足等）静默降级，不影响编辑 */
export function writeDraft(docId: string, content: CanvasEditorData): void {
  try {
    localStorage.setItem(draftKey(docId), JSON.stringify(content));
  } catch {
    // 草稿写入失败静默处理（草稿仅为兜底，不阻塞编辑与云端保存）
  }
}

/** 读取本地草稿；不存在或解析失败返回 null */
export function readDraft(docId: string): CanvasEditorData | null {
  try {
    const raw = localStorage.getItem(draftKey(docId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CanvasEditorData) : null;
  } catch {
    return null;
  }
}

/** 删除本地草稿（云端保存成功或用户主动丢弃时调用） */
export function removeDraft(docId: string): void {
  try {
    localStorage.removeItem(draftKey(docId));
  } catch {
    // 忽略移除失败
  }
}
