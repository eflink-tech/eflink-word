import { describe, it, expect } from 'vitest';
import { DEFAULT_PAGE_NUMBER_CONFIG } from '../uiStore';

describe('DEFAULT_PAGE_NUMBER_CONFIG', () => {
  it('uses fromPageNo 0 to match canvas-editor default (show from first page)', () => {
    expect(DEFAULT_PAGE_NUMBER_CONFIG.fromPageNo).toBe(0);
  });

  it('uses startPageNo 1 so first displayed page number is 1', () => {
    expect(DEFAULT_PAGE_NUMBER_CONFIG.startPageNo).toBe(1);
  });
});
