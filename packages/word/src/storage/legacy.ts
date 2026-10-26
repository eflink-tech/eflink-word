/**
 * efLink → DocuLuma 一次性本地数据迁移（本文件里的旧键字符串即迁移输入，勿删）。
 * IndexedDB 旧库名同样只在这里声明，读取逻辑由各存储模块引用常量完成。
 */
import {
  migrateLocalStorageKey,
  migrateLocalStoragePrefix,
  readLegacyIndexedDb,
} from '@eflink-tech/office-kit';
import {
  DRAFT_KEY_PREFIX,
  RECENT_COLORS_KEY_PREFIX,
  SETTINGS_FOOTER_COLOR_KEY,
  SETTINGS_HEADER_COLOR_KEY,
  SETTINGS_PAGENUMBER_COLOR_KEY,
} from './keys';

/** 旧 IndexedDB 库名（只读导入，永不删除旧库） */
export const LEGACY_INDEXED_DB_NAME = 'eflink-word';
export const LEGACY_AI_INDEXED_DB_NAME = 'eflink-word-ai';

/**
 * 把本仓库 efLink 前缀的 localStorage 数据一次性改名到 DocuLuma 前缀：
 * 草稿（按前缀）、工具栏最近颜色（按前缀）、状态栏三个颜色设置键（逐键）。
 * 在 src/index.ts 模块加载时调用一次；任何失败都不阻塞编辑器。
 */
export function migrateLegacyLocalStorage(): void {
  try {
    migrateLocalStoragePrefix('eflink:draft:word:', DRAFT_KEY_PREFIX);
    migrateLocalStoragePrefix('eflink-word:recent-colors:', RECENT_COLORS_KEY_PREFIX);
    migrateLocalStorageKey('eflink-word:settings:header-color', SETTINGS_HEADER_COLOR_KEY);
    migrateLocalStorageKey('eflink-word:settings:footer-color', SETTINGS_FOOTER_COLOR_KEY);
    migrateLocalStorageKey('eflink-word:settings:pagenumber-color', SETTINGS_PAGENUMBER_COLOR_KEY);
  } catch {
    // 迁移仅为兜底：失败时新键照常读写
  }
}

const legacyImportCache = new Map<string, Promise<void>>();

/**
 * 从旧 IndexedDB 库读取数据并按 `cacheKey` 记忆化导入（同一目标只跑一次）。
 * 具体「新表为空才写入」的判断放在 writeToNew 里；任何失败静默，不阻塞编辑器。
 */
export function importLegacyDb(
  cacheKey: string,
  oldName: string,
  storeNames: readonly string[],
  writeToNew: (rows: Record<string, unknown[]>) => Promise<void>,
): Promise<void> {
  let pending = legacyImportCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const legacy = await readLegacyIndexedDb(oldName, storeNames);
        if (!legacy) return;
        await writeToNew(legacy);
      } catch {
        // 导入失败不影响新库使用（旧库保持原样，可下次再试）
      }
    })();
    legacyImportCache.set(cacheKey, pending);
  }
  return pending;
}
