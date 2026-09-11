import { create } from 'zustand';
import type Editor from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useDocumentStore } from './documentStore';
import { getDefaultStorage } from '../storage/registry';
import { removeDraft } from '../storage/draft';

interface EditorState {
  editor: Editor | null;
  rangeStyle: IRangeStyle | null;
  currentPage: number;
  totalPages: number;
  pageScale: number;
  wordCount: number;
  isReady: boolean;
  isDirty: boolean;
  /** 内容变化计数：用户每次编辑递增。dirty 停留 true 期间靠它驱动草稿防抖 effect 重启 */
  contentVersion: number;

  setEditor: (editor: Editor) => void;
  setRangeStyle: (style: IRangeStyle) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setPageScale: (scale: number) => void;
  setWordCount: (count: number) => void;
  setIsDirty: (dirty: boolean) => void;
  /** 用户编辑导致内容变化：置 dirty 并递增计数（程序化装载文档内容不走这里） */
  markContentChanged: () => void;
  save: () => Promise<void>;
  reset: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  rangeStyle: null,
  currentPage: 1,
  totalPages: 1,
  pageScale: 1.0,
  wordCount: 0,
  isReady: false,
  isDirty: false,
  contentVersion: 0,

  setEditor: (editor) => set({ editor, isReady: true }),
  setRangeStyle: (style) => set({ rangeStyle: style }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setPageScale: (scale) => set({ pageScale: scale }),
  setWordCount: (count) => set({ wordCount: count }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  markContentChanged: () =>
    set((state) => ({ isDirty: true, contentVersion: state.contentVersion + 1 })),

  save: async () => {
    const { editor } = get();
    const { currentDocId, currentDocument } = useDocumentStore.getState();
    if (!editor || !currentDocId) return;

    try {
      const result = editor.command.getValue();
      await getDefaultStorage().updateContent(currentDocId, currentDocument?.title ?? '未命名文档', result.data);
      set({ isDirty: false });
      // 云端保存成功：本地草稿兜底完成使命，清除
      removeDraft(currentDocId);
    } catch (err) {
      // 保存失败时保持 isDirty=true，本地草稿保留，用户可稍后重试 ⌘S/Ctrl+S
      // eslint-disable-next-line no-console
      console.error('文档保存失败:', err);
    }
  },

  reset: () => {
    const { editor } = get();
    if (editor) editor.destroy();
    set({
      editor: null,
      rangeStyle: null,
      currentPage: 1,
      totalPages: 1,
      pageScale: 1.0,
      wordCount: 0,
      isReady: false,
      isDirty: false,
      contentVersion: 0,
    });
  },
}));
