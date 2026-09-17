import { describe, expect, it } from 'vitest';
import { parseDocxNumber } from '../docxUtils';

describe('parseDocxNumber', () => {
  it('解析纯数字字符串', () => {
    expect(parseDocxNumber('42')).toBe(42);
  });

  it('剥离单位后缀（pt/twip 等）', () => {
    expect(parseDocxNumber('42.67pt')).toBe(42.67);
    expect(parseDocxNumber('96 twip')).toBe(96);
  });

  it('空值与非有限值返回 0', () => {
    expect(parseDocxNumber(null)).toBe(0);
    expect(parseDocxNumber(undefined)).toBe(0);
    expect(parseDocxNumber('')).toBe(0);
    expect(parseDocxNumber('abc')).toBe(0);
  });
});
