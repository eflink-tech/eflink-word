// AI 数据持久化（Dexie）：设置 / 会话历史 / 内置提示词模板
import Dexie, { type Table } from 'dexie';
import type { AISettings, Conversation, Template } from './types';

export class AIDb extends Dexie {
  conversations!: Table<Conversation, string>;
  settings!: Table<AISettings & { key: string }, string>;
  templates!: Table<Template, string>;

  constructor() {
    super('eflink-word-ai');
    this.version(1).stores({
      conversations: 'id, updatedAt',
      settings: 'key',
      templates: 'id, builtin',
    });
  }
}

export const aiDb = new AIDb();

const SETTINGS_KEY = 'main';
const DEFAULT_SETTINGS: AISettings = { baseUrl: '', apiKey: '', model: '' };

export const aiSettingsStore = {
  async getSettings(): Promise<AISettings> {
    const row = await aiDb.settings.get(SETTINGS_KEY);
    if (!row) return { ...DEFAULT_SETTINGS };
    return { baseUrl: row.baseUrl, apiKey: row.apiKey, model: row.model };
  },

  async saveSettings(s: AISettings): Promise<void> {
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
