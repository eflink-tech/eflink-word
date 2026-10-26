/**
 * DocuLuma 命名空间下的本地存储键集中定义（迁移实现见 ./legacy.ts）。
 * 所有读写方一律引用这里的常量，不允许再写行内字面量。
 */

/** 本地草稿键前缀：doculuma:draft:word:<docId> */
export const DRAFT_KEY_PREFIX = 'doculuma:draft:word:';

/** 工具栏最近使用颜色键前缀：doculuma:word:recent-colors:<mode> */
export const RECENT_COLORS_KEY_PREFIX = 'doculuma:word:recent-colors:';

/** 状态栏设置里的颜色记忆键（页眉/页脚/页码） */
export const SETTINGS_HEADER_COLOR_KEY = 'doculuma:word:settings:header-color';
export const SETTINGS_FOOTER_COLOR_KEY = 'doculuma:word:settings:footer-color';
export const SETTINGS_PAGENUMBER_COLOR_KEY = 'doculuma:word:settings:pagenumber-color';

/** IndexedDB 库名（文档存储 + AI 存储） */
export const INDEXEDDB_DEFAULT_DB_NAME = 'doculuma-word';
export const AI_INDEXEDDB_NAME = 'doculuma-word-ai';
