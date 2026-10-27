// AI 数据持久化（Dexie）：设置 / 会话历史 / 内置提示词模板
import Dexie, { type Table } from 'dexie';
import { isLegacyImportDone, markLegacyImportDone } from '@eflink-tech/office-kit';
import { AI_INDEXEDDB_NAME } from '../storage/keys';
import { importLegacyDb, LEGACY_AI_INDEXED_DB_NAME } from '../storage/legacy';
import type { AISettings, Conversation, Template } from './types';

export class AIDb extends Dexie {
  conversations!: Table<Conversation, string>;
  settings!: Table<AISettings & { key: string }, string>;
  templates!: Table<Template, string>;

  constructor() {
    super(AI_INDEXEDDB_NAME);
    this.version(1).stores({
      conversations: 'id, updatedAt',
      settings: 'key',
      templates: 'id, builtin',
    });
  }
}

export const aiDb = new AIDb();

/**
 * 目标表非空则跳过（以新库为准）。
 * 无论导入成功还是跳过（旧表无数据 / 新表非空）都落一次性标记：
 * 否则用户删光对话后，下次启动空表判据再次命中，旧数据会"复活"且永远删不干净。
 * bulkPut 单事务原子写入，失败不落标记，下个会话自然重试。
 */
async function importTableIfEmpty<T>(
  table: Table<T, string>,
  rows: unknown[] | undefined,
  markerKey: string,
): Promise<void> {
  if (isLegacyImportDone(markerKey)) return;
  if (!rows || rows.length === 0) {
    markLegacyImportDone(markerKey);
    return;
  }
  if ((await table.count()) > 0) {
    markLegacyImportDone(markerKey);
    return;
  }
  await table.bulkPut(rows as T[]);
  markLegacyImportDone(markerKey);
}

/** 表为空时导入旧库（eflink-word-ai）对应数据；只读旧库、失败静默、进程内只跑一次。 */
export function ensureAiLegacyImport(): Promise<void> {
  return importLegacyDb(
    'ai',
    LEGACY_AI_INDEXED_DB_NAME,
    ['conversations', 'settings', 'templates'],
    async (rows) => {
      await importTableIfEmpty(aiDb.conversations, rows.conversations, 'doculuma:word:legacy-ai-imported:conversations');
      await importTableIfEmpty(aiDb.settings, rows.settings, 'doculuma:word:legacy-ai-imported:settings');
      await importTableIfEmpty(aiDb.templates, rows.templates, 'doculuma:word:legacy-ai-imported:templates');
    },
  );
}

const SETTINGS_KEY = 'main';
const DEFAULT_SETTINGS: AISettings = { baseUrl: '', apiKey: '', model: '' };

export const aiSettingsStore = {
  async getSettings(): Promise<AISettings> {
    await ensureAiLegacyImport();
    const row = await aiDb.settings.get(SETTINGS_KEY);
    if (!row) return { ...DEFAULT_SETTINGS };
    return { baseUrl: row.baseUrl, apiKey: row.apiKey, model: row.model };
  },

  async saveSettings(s: AISettings): Promise<void> {
    await ensureAiLegacyImport();
    await aiDb.settings.put({ key: SETTINGS_KEY, ...s });
  },

  async isConfigured(): Promise<boolean> {
    const s = await this.getSettings();
    return Boolean(s.baseUrl && s.apiKey && s.model);
  },
};

/** 选区/全文快捷操作模板：{text} 替换为选区内容（无选区时为全文） */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'tpl-polish',
    name: '润色',
    builtin: true,
    content: '请润色以下文本，使其表达更流畅、专业，保持原意，直接输出润色后的文本，不要解释：\n{text}',
  },
  {
    id: 'tpl-expand',
    name: '扩写',
    builtin: true,
    content: '请扩写以下文本，补充细节与论据，保持语言风格一致，直接输出扩写后的文本，不要解释：\n{text}',
  },
  {
    id: 'tpl-continue',
    name: '续写',
    builtin: true,
    content: '请接着以下文本自然续写（150 字左右），直接输出续写内容，不要重复原文，不要解释：\n{text}',
  },
  {
    id: 'tpl-translate',
    name: '译为英文',
    builtin: true,
    content: '请将以下文本翻译为英文，直接输出译文，不要解释：\n{text}',
  },
  {
    id: 'tpl-summarize',
    name: '总结',
    builtin: true,
    content: '请总结以下文本的要点，直接输出总结内容，不要解释：\n{text}',
  },
];
