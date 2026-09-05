import { describe, expect, it } from 'vitest';
import { formatCssColor, hsvToRgb, normalizeColor, rgbToHsv, toRgba } from '../colorFormat';

describe('normalizeColor', () => {
  it('normalizes hex', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor('#AABBCC')).toBe('#aabbcc');
  });
  it('keeps rgba', () => {
    expect(normalizeColor('rgba(1, 2, 3, 0.5)')).toMatch(/rgba\(1,\s*2,\s*3,\s*0\.5\)/);
  });
  it('rejects garbage', () => {
    expect(normalizeColor('nope')).toBeNull();
  });
});

describe('formatCssColor', () => {
  it('opaque to hex', () => {
    expect(formatCssColor(51, 51, 51, 1)).toBe('#333333');
  });
  it('transparent to rgba', () => {
    expect(formatCssColor(255, 0, 0, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });
});

describe('toRgba', () => {
  it('parses hex', () => {
    expect(toRgba('#333333')).toEqual({ r: 51, g: 51, b: 51, a: 1 });
  });
  it('parses rgba', () => {
    expect(toRgba('rgba(255, 0, 0, 0.5)')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });
  it('rejects invalid', () => {
    expect(toRgba('nope')).toBeNull();
  });
});

describe('hsv roundtrip', () => {
  it('converts rgb to hsv and back', () => {
    const hsv = rgbToHsv(255, 0, 0);
    expect(hsv.h).toBeCloseTo(0, 0);
    expect(hsv.s).toBeCloseTo(100, 0);
    expect(hsv.v).toBeCloseTo(100, 0);
    expect(hsvToRgb(hsv.h, hsv.s, hsv.v)).toEqual({ r: 255, g: 0, b: 0 });
  });
});
