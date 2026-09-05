export type RailMode = 'idle' | 'hover' | 'active';

export function resolveRailMode(args: {
  pointerInHit: boolean;
  selectionInTable: boolean;
  railActivated: boolean;
}): RailMode {
  const { pointerInHit, selectionInTable, railActivated } = args;
  if (!pointerInHit && !selectionInTable) return 'idle';
  if (selectionInTable || (railActivated && pointerInHit)) return 'active';
  if (pointerInHit) return 'hover';
  return 'idle';
}

export function isPointerInTableHit(args: {
  clientX: number;
  clientY: number;
  tableLeft: number;
  tableTop: number;
  tableWidth: number;
  tableHeight: number;
  pad?: number;
}): boolean {
  const pad = args.pad ?? 16;
  return (
    args.clientX >= args.tableLeft - pad &&
    args.clientX <= args.tableLeft + args.tableWidth + pad &&
    args.clientY >= args.tableTop - pad &&
    args.clientY <= args.tableTop + args.tableHeight + pad
  );
}

export function shouldShowGapPlus(distanceToGapPx: number, threshold = 8): boolean {
  return Math.abs(distanceToGapPx) <= threshold;
}
