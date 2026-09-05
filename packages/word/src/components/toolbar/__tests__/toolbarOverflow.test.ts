import { describe, it, expect } from 'vitest';
import { computeOverflowBuckets, type OverflowSlot } from '../toolbarOverflow';

function w(map: Record<string, number>) {
  return new Map(Object.entries(map));
}

function groupsOf(keys: string[][]): OverflowSlot[][] {
  return keys.map((row) => row.map((key) => ({ key, collapsible: true })));
}

describe('computeOverflowBuckets', () => {
  const groups = groupsOf([
    ['file'],
    ['a', 'b'],
    ['c', 'd'],
    ['e', 'f'],
  ]);
  // widths all 20; dividers 3*5=15; total = 15 + 7*20 = 155
  const widths = w({ file: 20, a: 20, b: 20, c: 20, d: 20, e: 20, f: 20 });

  it('hides nothing when space is enough', () => {
    const r = computeOverflowBuckets(groups, 200, widths, 1300);
    expect(r.hiddenKeys.size).toBe(0);
    expect(r.buckets).toEqual([]);
  });

  it('narrow viewport collapses all overflow into one bucket', () => {
    // force hide from end: available small
    const r = computeOverflowBuckets(groups, 80, widths, 1000);
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].id).toBe('bucket-1');
    expect(r.hiddenKeys.size).toBeGreaterThan(0);
    expect(r.buckets[0].keys.every((k) => r.hiddenKeys.has(k))).toBe(true);
    expect([...r.hiddenKeys].every((k) => k !== 'file')).toBe(true);
  });

  it('wide viewport with two folded groups yields two buckets', () => {
    // Start total 155. Hide f(+MORE once)=155-20+26=161; hide e=161-20=141;
    // hide d=141-20+26=147; hide c=147-20=127. Need available < final after enough hides.
    const r = computeOverflowBuckets(groups, 100, widths, 1400);
    const foldedGroups = [1, 2, 3].filter((gi) =>
      groups[gi].some((s) => r.hiddenKeys.has(s.key)),
    );
    expect(foldedGroups.length).toBeGreaterThanOrEqual(2);
    expect(r.buckets.length).toBeLessThanOrEqual(2);
    if (foldedGroups.length >= 2) {
      expect(r.buckets).toHaveLength(2);
      expect(r.buckets[0].id).toBe('bucket-1');
      expect(r.buckets[1].id).toBe('bucket-2');
      const k = foldedGroups.length;
      const bucket1Groups = foldedGroups.slice(0, k - 1);
      const lastGi = foldedGroups[k - 1];
      expect(r.buckets[0].anchorGroupIndex).toBe(foldedGroups[k - 2]);
      expect(
        r.buckets[0].keys.every((key) =>
          bucket1Groups.some((gi) => groups[gi].some((s) => s.key === key)),
        ),
      ).toBe(true);
      expect(
        r.buckets[0].keys.every(
          (key) => !groups[lastGi].some((s) => s.key === key),
        ),
      ).toBe(true);
      expect(r.buckets[1].anchorGroupIndex).toBe(lastGi);
      expect(r.buckets[1].keys.every((key) => groups[lastGi].some((s) => s.key === key))).toBe(
        true,
      );
    }
  });

  it('never creates a third bucket', () => {
    const many = groupsOf([
      ['file'],
      ['a1', 'a2'],
      ['b1', 'b2'],
      ['c1', 'c2'],
      ['d1', 'd2'],
      ['e1', 'e2'],
    ]);
    const mw = new Map<string, number>();
    many.flat().forEach((s) => mw.set(s.key, 40));
    const r = computeOverflowBuckets(many, 50, mw, 1600);
    expect(r.buckets.length).toBeLessThanOrEqual(2);
  });

  it('never hides file menu slots', () => {
    const r = computeOverflowBuckets(groups, 10, widths, 800);
    expect(r.hiddenKeys.has('file')).toBe(false);
  });

  it('never hides slots with collapsible false under extreme pressure', () => {
    const withPin: OverflowSlot[][] = [
      [{ key: 'file' }],
      [
        { key: 'pin', collapsible: false },
        { key: 'a', collapsible: true },
        { key: 'b', collapsible: true },
      ],
      [{ key: 'c' }, { key: 'd' }],
    ];
    const pinWidths = w({ file: 20, pin: 20, a: 20, b: 20, c: 20, d: 20 });
    const r = computeOverflowBuckets(withPin, 10, pinWidths, 1400);
    expect(r.hiddenKeys.has('pin')).toBe(false);
    expect(r.hiddenKeys.size).toBeGreaterThan(0);
    expect(
      withPin[1].some((s) => s.collapsible !== false && r.hiddenKeys.has(s.key)),
    ).toBe(true);
  });
});
