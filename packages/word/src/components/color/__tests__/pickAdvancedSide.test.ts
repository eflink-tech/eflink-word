import { describe, expect, it } from 'vitest';
import { ADVANCED_PANEL_WIDTH, pickAdvancedSide } from '../pickAdvancedSide';

describe('pickAdvancedSide', () => {
  it('prefers right when there is room', () => {
    expect(
      pickAdvancedSide({
        paletteLeft: 100,
        paletteRight: 340,
        viewportWidth: 800,
      }),
    ).toBe('right');
  });

  it('uses left when right side is too narrow', () => {
    expect(
      pickAdvancedSide({
        paletteLeft: 400,
        paletteRight: 640,
        viewportWidth: 700,
      }),
    ).toBe('left');
  });

  it('picks the roomier side when neither fully fits', () => {
    expect(
      pickAdvancedSide({
        paletteLeft: 200,
        paletteRight: 440,
        viewportWidth: 490,
        advancedWidth: ADVANCED_PANEL_WIDTH,
      }),
    ).toBe('left');
  });
});
