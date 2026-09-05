import type Editor from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';

export interface EventBridgeCallbacks {
  onRangeStyleChange?: (payload: IRangeStyle) => void;
  onContentChange?: () => void;
  onPageNoChange?: (pageNo: number) => void;
  onPageSizeChange?: (size: number) => void;
  onPageScaleChange?: (scale: number) => void;
}

export interface EventBridgeHandle {
  unmount: () => void;
}

export function mountEventBridge(
  editor: Editor,
  callbacks: EventBridgeCallbacks,
): EventBridgeHandle {
  if (callbacks.onRangeStyleChange) {
    editor.eventBus.on('rangeStyleChange', callbacks.onRangeStyleChange);
  }
  if (callbacks.onContentChange) {
    editor.eventBus.on('contentChange', callbacks.onContentChange);
  }
  if (callbacks.onPageNoChange) {
    editor.eventBus.on('intersectionPageNoChange', callbacks.onPageNoChange);
  }
  if (callbacks.onPageSizeChange) {
    editor.eventBus.on('pageSizeChange', callbacks.onPageSizeChange);
  }
  if (callbacks.onPageScaleChange) {
    editor.eventBus.on('pageScaleChange', callbacks.onPageScaleChange);
  }

  return {
    unmount: () => {
      if (callbacks.onRangeStyleChange) editor.eventBus.off('rangeStyleChange', callbacks.onRangeStyleChange);
      if (callbacks.onContentChange) editor.eventBus.off('contentChange', callbacks.onContentChange);
      if (callbacks.onPageNoChange) editor.eventBus.off('intersectionPageNoChange', callbacks.onPageNoChange);
      if (callbacks.onPageSizeChange) editor.eventBus.off('pageSizeChange', callbacks.onPageSizeChange);
      if (callbacks.onPageScaleChange) editor.eventBus.off('pageScaleChange', callbacks.onPageScaleChange);
    },
  };
}
