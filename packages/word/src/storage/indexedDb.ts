import Dexie from 'dexie';
import type { CanvasEditorData, DocumentMeta, WordDocument } from '../types/document';
import type { StorageAdapter } from './types';

// Dexie 对 canvas-editor 递归 IElement 结构的深度路径推断会产生 TS2615 循环引用，
// 与历史单体版一致：这里用最小结构类型绕开泛型推断（全项目唯一一处）
type DocumentsTable = {
  put(doc: WordDocument): Promise<string>;
  get(id: string): Promise<WordDocument | undefined>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
  update(id: string, changes: Record<string, unknown>): Promise<number>;
  orderBy(index: string): {
    reverse(): { toArray(): Promise<WordDocument[]> };
  };
};

type WordDBInstance = {
  version(v: number): { stores(schema: Record<string, string | null>): unknown };
  documents: DocumentsTable;
};

const DexieBase = Dexie as unknown as new (name: string) => WordDBInstance;

class WordDB extends DexieBase {
  declare documents: DocumentsTable;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      documents: 'id, title, createdAt, updatedAt, isFavorite, isDeleted',
    });
  }
}

/** 内置 IndexedDB 存储（Dexie）。dbName 缺省与历史单体版一致，老数据可直接读回。 */
export function indexedDbStorage(dbName = 'eflink-word'): StorageAdapter {
  const db = new WordDB(dbName);
  return {
    async save(doc) {
      await db.documents.put(doc);
    },
    async load(id) {
      const doc = await db.documents.get(id);
      return doc && !doc.isDeleted ? doc : undefined;
    },
    async list(): Promise<DocumentMeta[]> {
      const all = await db.documents.orderBy('updatedAt').reverse().toArray();
      return all
        .filter((doc) => !doc.isDeleted)
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
    },
    async delete(id) {
      // 软删除：与历史单体版一致，保留数据可恢复
      await db.documents.update(id, { isDeleted: true, updatedAt: Date.now() });
    },
    async rename(id, title) {
      await db.documents.update(id, { title, updatedAt: Date.now() });
    },
    async updateContent(id, title, content: CanvasEditorData) {
      await db.documents.update(id, { title, content, updatedAt: Date.now() });
    },
    async clear() {
      await db.documents.clear();
    },
  };
}
