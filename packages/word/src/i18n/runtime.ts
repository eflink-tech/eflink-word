import { COMMON_MESSAGES, normalizeLocale, type OfficeLocale, type OfficeMessages } from '@eflink-tech/office-kit';
import { WORD_MESSAGES } from './messages';

let currentLocale: OfficeLocale = normalizeLocale();

export function setWordLocale(locale: string | null | undefined): OfficeLocale {
  currentLocale = normalizeLocale(locale);
  return currentLocale;
}

export function getWordLocale(): OfficeLocale {
  return currentLocale;
}

/** 与 I18nProvider 同源：共用文案打底，编辑器文案按 key 覆盖 */
const MERGED: Partial<Record<OfficeLocale, OfficeMessages>> = {};
function dictFor(locale: OfficeLocale): OfficeMessages {
  MERGED[locale] ??= { ...COMMON_MESSAGES[locale], ...WORD_MESSAGES[locale] };
  return MERGED[locale]!;
}

/**
 * 非 React 模块（store / AI / 文件导入导出）使用的翻译入口，缺省回退 zh-CN。
 * 测试环境不挂 I18nProvider：导入本模块即注册 WORD_MESSAGES，可直接断言 zh-CN 文案。
 */
export function wordT(key: string, vars?: Record<string, string | number>): string {
  const template = dictFor(currentLocale)[key] ?? dictFor('zh-CN')[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}
