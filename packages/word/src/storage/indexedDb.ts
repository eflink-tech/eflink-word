import Dexie from 'dexie';
import { isLegacyImportDone, markLegacyImportDone } from '@eflink-tech/office-kit';
import { INDEXEDDB_DEFAULT_DB_NAME } from './keys';
import { importLegacyDb, LEGACY_INDEXED_DB_NAME } from './legacy';
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
  count(): Promise<number>;
  bulkPut(docs: WordDocument[]): Promise<unknown>;
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

/** 一次性导入标记键：按「目标库名 + 表」各落一个 key（localStorage），导入成功或确定跳过后写入 */
function legacyImportMarkerKey(dbName: string): string {
  return `doculuma:word:legacy-imported:${dbName}:documents`;
}

/**
 * 旧库（eflink-word）一次性导入：仅当新库 documents 表为空时 bulkPut 旧数据；
 * 只读旧库、绝不删除；失败静默，不阻塞编辑器。按库名记忆化，进程内只跑一次。
 * 无论导入成功还是「跳过」（旧库无数据 / 新表非空）都落一次性标记：
 * 否则用户删光文档后，下次启动空表判据再次命中，旧数据会"复活"且永远删不干净。
 * bulkPut 单事务原子写入，失败不落标记，下个会话自然重试。
 */
function ensureLegacyImport(db: WordDB, dbName: string): Promise<void> {
  const markerKey = legacyImportMarkerKey(dbName);
  return importLegacyDb(`documents:${dbName}`, LEGACY_INDEXED_DB_NAME, ['documents'], async (legacy) => {
    if (isLegacyImportDone(markerKey)) return;
    const rows = (legacy.documents ?? []) as WordDocument[];
    if (rows.length === 0) {
      markLegacyImportDone(markerKey);
      return;
    }
    if ((await db.documents.count()) > 0) {
      markLegacyImportDone(markerKey);
      return;
    }
    await db.documents.bulkPut(rows);
    markLegacyImportDone(markerKey);
  });
}

/** 内置 IndexedDB 存储（Dexie）。库名缺省为 DocuLuma 命名空间；旧 eflink-word 数据在首个存储操作前自动导入一次。 */
export function indexedDbStorage(dbName = INDEXEDDB_DEFAULT_DB_NAME): StorageAdapter {
  const db = new WordDB(dbName);
  return {
    async save(doc) {
      await ensureLegacyImport(db, dbName);
      await db.documents.put(doc);
    },
    async load(id) {
      await ensureLegacyImport(db, dbName);
      const doc = await db.documents.get(id);
      return doc && !doc.isDeleted ? doc : undefined;
    },
    async list(): Promise<DocumentMeta[]> {
      await ensureLegacyImport(db, dbName);
      const all = await db.documents.orderBy('updatedAt').reverse().toArray();
      return all
        .filter((doc) => !doc.isDeleted)
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
    },
    async delete(id) {
      await ensureLegacyImport(db, dbName);
      // 软删除：与历史单体版一致，保留数据可恢复
      await db.documents.update(id, { isDeleted: true, updatedAt: Date.now() });
    },
    async rename(id, title) {
      await ensureLegacyImport(db, dbName);
      await db.documents.update(id, { title, updatedAt: Date.now() });
    },
    async updateContent(id, title, content: CanvasEditorData) {
      await ensureLegacyImport(db, dbName);
      await db.documents.update(id, { title, content, updatedAt: Date.now() });
    },
    async clear() {
      // 清空就是清空：绝不触发旧库导入，否则"清空"自带旧数据复活
      await db.documents.clear();
    },
  };
}
