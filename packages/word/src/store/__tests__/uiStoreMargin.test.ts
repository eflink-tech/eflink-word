import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, MARGIN_PRESETS } from '../uiStore';

describe('setMarginCustom', () => {
  beforeEach(() => {
    useUIStore.setState({
      margin: MARGIN_PRESETS[0],
      catalogOpen: true,
      settingsOpen: false,
    });
  });
  it('sets label 自定义 and px values', () => {
    useUIStore.getState().setMarginCustom({ top: 10, right: 20, bottom: 30, left: 40 });
    const m = useUIStore.getState().margin;
    expect(m.label).toBe('自定义');
    expect(m).toMatchObject({ top: 10, right: 20, bottom: 30, left: 40 });
  });
  it('toggleCatalog flips', () => {
    useUIStore.getState().toggleCatalog();
    expect(useUIStore.getState().catalogOpen).toBe(false);
  });
});
