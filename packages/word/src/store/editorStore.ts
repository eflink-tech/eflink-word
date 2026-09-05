import { create } from 'zustand';
import type Editor from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';
import { useDocumentStore } from './documentStore';
import { getDefaultStorage } from '../storage/registry';

interface EditorState {
  editor: Editor | null;
  rangeStyle: IRangeStyle | null;
  currentPage: number;
  totalPages: number;
  pageScale: number;
  wordCount: number;
  isReady: boolean;
  isDirty: boolean;

  setEditor: (editor: Editor) => void;
  setRangeStyle: (style: IRangeStyle) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setPageScale: (scale: number) => void;
  setWordCount: (count: number) => void;
  setIsDirty: (dirty: boolean) => void;
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

  setEditor: (editor) => set({ editor, isReady: true }),
  setRangeStyle: (style) => set({ rangeStyle: style }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setPageScale: (scale) => set({ pageScale: scale }),
  setWordCount: (count) => set({ wordCount: count }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),

  save: async () => {
    const { editor } = get();
    const { currentDocId, currentDocument } = useDocumentStore.getState();
    if (!editor || !currentDocId) return;

    try {
      const result = editor.command.getValue();
      await getDefaultStorage().updateContent(currentDocId, currentDocument?.title ?? '未命名文档', result.data);
      set({ isDirty: false });
    } catch (err) {
      // 保存失败时保持 isDirty=true，以便下次自动保存重试
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
    });
  },
}));
