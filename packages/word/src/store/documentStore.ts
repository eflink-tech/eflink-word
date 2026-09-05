import { create } from 'zustand';
import { createWordDocument, type DocumentMeta, type WordDocument } from '../types/document';
import { getDefaultStorage } from '../storage/registry';

/** 文档 id 变化监听器：新建文档导致当前文档切换时触发，宿主据此同步路由等 */
export type DocIdChangeListener = (id: string) => void;

interface DocumentState {
  documents: DocumentMeta[];
  currentDocId: string | null;
  currentDocument: WordDocument | null;
  /** 由 WordEditor 挂载时注入（来自 props.onDocIdChange） */
  docIdChangeListener: DocIdChangeListener | null;

  /** 加载文档元信息列表（按更新时间倒序），返回列表便于宿主判断目标文档是否存在 */
  loadDocuments: () => Promise<DocumentMeta[]>;
  /** 新建文档并落库，返回新文档 id */
  createDocument: (title?: string) => Promise<string>;
  /** 新建并打开：内部触发 docIdChangeListener 通知宿主 */
  createAndOpenDocument: (title?: string) => Promise<string>;
  deleteDocument: (id: string) => Promise<void>;
  renameDocument: (id: string, title: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  /** 打开文档；返回加载到的文档，不存在时返回 undefined */
  openDocument: (id: string) => Promise<WordDocument | undefined>;
  /** 注册/注销文档 id 变化监听（WordEditor 内部使用） */
  setDocIdChangeListener: (listener: DocIdChangeListener | null) => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocId: null,
  currentDocument: null,
  docIdChangeListener: null,

  loadDocuments: async () => {
    const docs = await getDefaultStorage().list();
    set({ documents: docs });
    return docs;
  },

  createDocument: async (title?: string) => {
    const doc = createWordDocument({ title });
    await getDefaultStorage().save(doc);
    set((state) => ({
      documents: [{ id: doc.id, title: doc.title, updatedAt: doc.updatedAt }, ...state.documents],
    }));
    return doc.id;
  },

  createAndOpenDocument: async (title?: string) => {
    const id = await get().createDocument(title);
    await get().openDocument(id);
    get().docIdChangeListener?.(id);
    return id;
  },

  deleteDocument: async (id: string) => {
    await getDefaultStorage().delete(id);
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      currentDocId: state.currentDocId === id ? null : state.currentDocId,
      currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
    }));
  },

  renameDocument: async (id: string, title: string) => {
    await getDefaultStorage().rename(id, title);
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, title } : d)),
      currentDocument:
        state.currentDocument?.id === id ? { ...state.currentDocument, title } : state.currentDocument,
    }));
  },

  toggleFavorite: async (id: string) => {
    const doc = await getDefaultStorage().load(id);
    if (!doc) return;
    await getDefaultStorage().save({ ...doc, isFavorite: !doc.isFavorite, updatedAt: Date.now() });
    set((state) => ({
      currentDocument:
        state.currentDocument?.id === id
          ? { ...state.currentDocument, isFavorite: !doc.isFavorite }
          : state.currentDocument,
    }));
  },

  openDocument: async (id: string) => {
    const doc = await getDefaultStorage().load(id);
    if (doc) {
      set({ currentDocId: id, currentDocument: doc });
    }
    return doc;
  },

  setDocIdChangeListener: (listener) => set({ docIdChangeListener: listener }),
}));
