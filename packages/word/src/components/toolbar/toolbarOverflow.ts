export const MORE_WIDTH = 26;
export const DIVIDER_WIDTH = 5;
export const VIEWPORT_NARROW_MAX = 1199;

export type OverflowSlot = { key: string; collapsible?: boolean };

export type OverflowBucket = {
  id: 'bucket-1' | 'bucket-2';
  keys: string[];
  anchorGroupIndex: number;
};

function slotWidth(widths: Map<string, number>, key: string): number {
  return widths.get(key) ?? 0;
}

function computeTotalWidth(
  groups: OverflowSlot[][],
  widths: Map<string, number>,
  hiddenKeys: Set<string>,
  groupsWithMore: Set<number>,
): number {
  let total = (groups.length - 1) * DIVIDER_WIDTH;
  for (let gi = 0; gi < groups.length; gi++) {
    for (const slot of groups[gi]) {
      if (!hiddenKeys.has(slot.key)) {
        total += slotWidth(widths, slot.key);
      }
    }
  }
  for (const _gi of groupsWithMore) {
    total += MORE_WIDTH;
  }
  return total;
}

function collectHiddenKeysForGroups(
  groups: OverflowSlot[][],
  groupIndices: number[],
  hiddenKeys: Set<string>,
): string[] {
  const keys: string[] = [];
  for (const gi of groupIndices) {
    for (const slot of groups[gi]) {
      if (hiddenKeys.has(slot.key)) {
        keys.push(slot.key);
      }
    }
  }
  return keys;
}

function buildBuckets(
  groups: OverflowSlot[][],
  hiddenKeys: Set<string>,
  viewportWidth: number,
): OverflowBucket[] {
  const G: number[] = [];
  for (let gi = 1; gi < groups.length; gi++) {
    if (groups[gi].some((s) => hiddenKeys.has(s.key))) {
      G.push(gi);
    }
  }

  if (G.length === 0) {
    return [];
  }

  const isNarrow = viewportWidth <= VIEWPORT_NARROW_MAX;

  if (isNarrow) {
    return [
      {
        id: 'bucket-1',
        keys: collectHiddenKeysForGroups(groups, G, hiddenKeys),
        anchorGroupIndex: G[G.length - 1],
      },
    ];
  }

  if (G.length === 1) {
    return [
      {
        id: 'bucket-1',
        keys: collectHiddenKeysForGroups(groups, G, hiddenKeys),
        anchorGroupIndex: G[0],
      },
    ];
  }

  const k = G.length;
  const bucket1Groups = G.slice(0, k - 1);
  const bucket2Group = G[k - 1];

  return [
    {
      id: 'bucket-1',
      keys: collectHiddenKeysForGroups(groups, bucket1Groups, hiddenKeys),
      anchorGroupIndex: G[k - 2],
    },
    {
      id: 'bucket-2',
      keys: collectHiddenKeysForGroups(groups, [bucket2Group], hiddenKeys),
      anchorGroupIndex: bucket2Group,
    },
  ];
}

export function computeOverflowBuckets(
  groups: OverflowSlot[][],
  available: number,
  widths: Map<string, number>,
  viewportWidth: number,
): { hiddenKeys: Set<string>; buckets: OverflowBucket[] } {
  const hiddenKeys = new Set<string>();
  const groupsWithMore = new Set<number>();

  let total = computeTotalWidth(groups, widths, hiddenKeys, groupsWithMore);

  if (total <= available) {
    return { hiddenKeys, buckets: [] };
  }

  let canHideMore = true;
  while (total > available && canHideMore) {
    canHideMore = false;

    for (let gi = groups.length - 1; gi >= 1; gi--) {
      if (total <= available) {
        break;
      }

      const group = groups[gi];
      for (let si = group.length - 1; si >= 0; si--) {
        if (total <= available) {
          break;
        }

        const slot = group[si];
        if (hiddenKeys.has(slot.key)) {
          continue;
        }
        if (slot.collapsible === false) {
          continue;
        }

        if (!groupsWithMore.has(gi)) {
          groupsWithMore.add(gi);
          total += MORE_WIDTH;
        }

        total -= slotWidth(widths, slot.key);
        hiddenKeys.add(slot.key);
        canHideMore = true;
      }
    }
  }

  const buckets = buildBuckets(groups, hiddenKeys, viewportWidth);

  return { hiddenKeys, buckets };
}
