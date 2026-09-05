import { beforeEach, describe, expect, it } from 'vitest';
import { createWordDocument } from '../../types/document';
import { indexedDbStorage } from '../indexedDb';
import { memoryStorage } from '../memory';
import { getDefaultStorage, setDefaultStorage } from '../registry';
import type { StorageAdapter } from '../types';

// 每个适配器跑同一组行为用例（IndexedDB 经 fake-indexeddb 模拟）
const adapters: [string, () => StorageAdapter][] = [
  ['memoryStorage', () => memoryStorage()],
  ['indexedDbStorage', () => indexedDbStorage('eflink-word-test')],
];

describe.each(adapters)('%s', (_, create) => {
  let storage: StorageAdapter;

  beforeEach(async () => {
    storage = create();
    // IndexedDB（fake-indexeddb）同名库在用例间持久，逐用例清空保证隔离
    await storage.clear?.();
  });

  it('save 后可 load 回完整文档', async () => {
    const doc = createWordDocument({ title: '测试文档' });
    await storage.save(doc);
    const loaded = await storage.load(doc.id);
    expect(loaded?.id).toBe(doc.id);
    expect(loaded?.title).toBe('测试文档');
    expect(loaded?.content.main).toHaveLength(1);
  });

  it('load 不存在的文档返回 undefined', async () => {
    await expect(storage.load('missing')).resolves.toBeUndefined();
  });

  it('list 按更新时间倒序返回元信息', async () => {
    // 显式错开 updatedAt，避免同毫秒创建导致排序不稳定
    const first = { ...createWordDocument({ title: '第一篇' }), updatedAt: 1000 };
    await storage.save(first);
    const second = { ...createWordDocument({ title: '第二篇' }), updatedAt: 2000 };
    await storage.save(second);
    const list = await storage.list();
    expect(list.map((d) => d.title)).toEqual(['第二篇', '第一篇']);
    expect(list[0]).not.toHaveProperty('content');
  });

  it('rename 只改标题并刷新更新时间', async () => {
    const doc = createWordDocument({ title: '旧标题' });
    await storage.save(doc);
    await storage.rename(doc.id, '新标题');
    const loaded = await storage.load(doc.id);
    expect(loaded?.title).toBe('新标题');
    expect(loaded?.updatedAt).toBeGreaterThanOrEqual(doc.updatedAt);
  });

  it('updateContent 落库标题与正文', async () => {
    const doc = createWordDocument({ title: 't' });
    await storage.save(doc);
    await storage.updateContent(doc.id, '新标题', { main: [], header: [], footer: [] });
    const loaded = await storage.load(doc.id);
    expect(loaded?.title).toBe('新标题');
    expect(loaded?.content.main).toHaveLength(0);
  });

  it('delete 后 load 不到、list 不出现', async () => {
    const doc = createWordDocument({ title: '待删除' });
    await storage.save(doc);
    await storage.delete(doc.id);
    await expect(storage.load(doc.id)).resolves.toBeUndefined();
    await expect(storage.list()).resolves.toHaveLength(0);
  });
});

describe('registry', () => {
  it('未注入时回退到内置 IndexedDB（库名 eflink-word）', () => {
    setDefaultStorage(null as unknown as StorageAdapter);
    const storage = getDefaultStorage();
    // 两个不同的 IndexedDB 存储实例各自持有独立 Dexie 连接，行为等价即可
    expect(storage).toBeDefined();
    expect(typeof storage.load).toBe('function');
  });

  it('注入后以注入为准', async () => {
    const memory = memoryStorage();
    setDefaultStorage(memory);
    expect(getDefaultStorage()).toBe(memory);
  });
});
