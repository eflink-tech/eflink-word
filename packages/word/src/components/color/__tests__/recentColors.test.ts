import { beforeEach, describe, expect, it } from 'vitest';
import { loadRecent, pushRecent, RECENT_MAX } from '../recentColors';

describe('recentColors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports RECENT_MAX as 10', () => {
    expect(RECENT_MAX).toBe(10);
  });

  it('loadRecent returns empty for missing key', () => {
    expect(loadRecent('missing:key')).toEqual([]);
  });

  it('pushRecent dedupes and caps at 10', () => {
    const key = 'test:recent';
    localStorage.clear();
    for (let i = 0; i < 12; i++) {
      pushRecent(key, `#${i.toString(16).padStart(6, '0')}`);
    }
    const list = loadRecent(key);
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('#00000b');
  });

  it('pushRecent moves duplicate to front', () => {
    const key = 'test:recent-dedupe';
    pushRecent(key, '#ff0000');
    pushRecent(key, '#00ff00');
    pushRecent(key, '#ff0000');
    expect(loadRecent(key)).toEqual(['#ff0000', '#00ff00']);
  });

  it('pushRecent ignores invalid color', () => {
    const key = 'test:recent-invalid';
    pushRecent(key, '#aabbcc');
    pushRecent(key, 'not-a-color');
    expect(loadRecent(key)).toEqual(['#aabbcc']);
  });

  it('loadRecent tolerates corrupt JSON', () => {
    localStorage.setItem('test:corrupt', '{not json');
    expect(loadRecent('test:corrupt')).toEqual([]);
  });

  it('loadRecent filters invalid entries', () => {
    localStorage.setItem('test:filter', JSON.stringify(['#aabbcc', 'bad', '#112233']));
    expect(loadRecent('test:filter')).toEqual(['#aabbcc', '#112233']);
  });
});
