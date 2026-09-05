import { describe, expect, it } from 'vitest';
import { STANDARD_COLORS, THEME_COLORS } from '../colorPalette';

describe('colorPalette', () => {
  it('theme is 10x6', () => {
    expect(THEME_COLORS).toHaveLength(10);
    for (const col of THEME_COLORS) expect(col).toHaveLength(6);
  });

  it('standard is 10', () => {
    expect(STANDARD_COLORS).toHaveLength(10);
  });

  it('all colors are valid hex', () => {
    const hexRe = /^#[0-9a-f]{6}$/;
    for (const col of THEME_COLORS) {
      for (const color of col) {
        expect(color).toMatch(hexRe);
      }
    }
    for (const color of STANDARD_COLORS) {
      expect(color).toMatch(hexRe);
    }
  });
});
