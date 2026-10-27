// IndexedDB 旧库一次性导入语义（防"删光复活"回归）：
// 旧库 eflink-word 只读导入一次并落 localStorage 标记；此后即便新库被清空也不再回填。
import { beforeEach, describe, expect, it } from 'vitest';
import { createWordDocument } from '../../types/document';
import { indexedDbStorage } from '../indexedDb';
import { LEGACY_INDEXED_DB_NAME } from '../legacy';

/** 用原生 indexedDB 往旧库灌数据（不经 Dexie，模拟真实历史版本库） */
function seedLegacyDb(docs: Array<Record<string, unknown>>): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_INDEXED_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('documents', 'readwrite');
      for (const doc of docs) tx.objectStore('documents').put(doc);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error(`deleteDatabase(${name}) blocked`));
  });
}

let dbNameSeq = 0;

describe('indexedDbStorage 旧库一次性导入', () => {
  beforeEach(async () => {
    localStorage.clear();
    await deleteDatabase(LEGACY_INDEXED_DB_NAME);
  });

  it('旧库有数据：首个存储操作回填并落一次性标记', async () => {
    const legacyDoc = createWordDocument({ title: '旧库文档' });
    await seedLegacyDb([{ ...legacyDoc, content: { main: [], header: [], footer: [] } }]);

    const dbName = `doculuma-word-idbtest-${(dbNameSeq += 1)}`;
    const storage = indexedDbStorage(dbName);
    const list = await storage.list();
    expect(list.map((d) => d.title)).toEqual(['旧库文档']);
    expect(localStorage.getItem(`doculuma:word:legacy-imported:${dbName}:documents`)).toBe('1');
  });

  it('clear() 只清新库，绝不触发旧库回填', async () => {
    const legacyDoc = createWordDocument({ title: '旧库文档' });
    await seedLegacyDb([{ ...legacyDoc, content: { main: [], header: [], footer: [] } }]);

    const storage = indexedDbStorage(`doculuma-word-idbtest-${(dbNameSeq += 1)}`);
    await storage.list(); // 触发导入
    await storage.clear?.();
    await expect(storage.list()).resolves.toEqual([]);
  });

  it('导入完成后删光文档，重启式新实例也不会复活旧数据', async () => {
    const legacyDoc = createWordDocument({ title: '旧库文档' });
    await seedLegacyDb([{ ...legacyDoc, content: { main: [], header: [], footer: [] } }]);

    const dbName = `doculuma-word-idbtest-${(dbNameSeq += 1)}`;
    const first = indexedDbStorage(dbName);
    await first.list(); // 导入 + 落标记
    const imported = await first.list();
    await first.delete?.(imported[0]!.id);
    await expect(first.list()).resolves.toEqual([]);

    // 模拟下次会话：全新实例（同库新连接），标记仍在 → 空表不再回填
    const second = indexedDbStorage(dbName);
    await expect(second.list()).resolves.toEqual([]);
  });
});
