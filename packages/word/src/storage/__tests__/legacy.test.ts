import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyLocalStorage } from '../legacy';

describe('migrateLegacyLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('草稿/最近颜色/设置颜色键一次性改名到新命名空间，旧键删除', () => {
    localStorage.setItem('eflink:draft:word:doc-1', '{"main":[]}');
    localStorage.setItem('eflink:draft:word:doc-2', '{"main":[1]}');
    localStorage.setItem('eflink-word:recent-colors:color', '["#ff0000"]');
    localStorage.setItem('eflink-word:settings:header-color', '#0000ff');
    localStorage.setItem('eflink-word:settings:footer-color', '#00ff00');
    localStorage.setItem('eflink-word:settings:pagenumber-color', '#111111');

    migrateLegacyLocalStorage();

    expect(localStorage.getItem('doculuma:draft:word:doc-1')).toBe('{"main":[]}');
    expect(localStorage.getItem('doculuma:draft:word:doc-2')).toBe('{"main":[1]}');
    expect(localStorage.getItem('doculuma:word:recent-colors:color')).toBe('["#ff0000"]');
    expect(localStorage.getItem('doculuma:word:settings:header-color')).toBe('#0000ff');
    expect(localStorage.getItem('doculuma:word:settings:footer-color')).toBe('#00ff00');
    expect(localStorage.getItem('doculuma:word:settings:pagenumber-color')).toBe('#111111');

    // 真改名：旧键必须消失
    expect(localStorage.getItem('eflink:draft:word:doc-1')).toBeNull();
    expect(localStorage.getItem('eflink:draft:word:doc-2')).toBeNull();
    expect(localStorage.getItem('eflink-word:recent-colors:color')).toBeNull();
    expect(localStorage.getItem('eflink-word:settings:header-color')).toBeNull();
    expect(localStorage.getItem('eflink-word:settings:footer-color')).toBeNull();
    expect(localStorage.getItem('eflink-word:settings:pagenumber-color')).toBeNull();
  });

  it('新键已有值时不覆盖，仅清理旧键；无关键保持不动', () => {
    localStorage.setItem('eflink:draft:word:doc-1', 'legacy');
    localStorage.setItem('doculuma:draft:word:doc-1', 'current');
    localStorage.setItem('eflink:draft:other', 'untouched');

    migrateLegacyLocalStorage();

    expect(localStorage.getItem('doculuma:draft:word:doc-1')).toBe('current');
    expect(localStorage.getItem('eflink:draft:word:doc-1')).toBeNull();
    expect(localStorage.getItem('eflink:draft:other')).toBe('untouched');
  });
});
