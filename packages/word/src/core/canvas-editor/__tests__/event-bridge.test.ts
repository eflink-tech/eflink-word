import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Editor from '@hufe921/canvas-editor';
import { mountEventBridge } from '../event-bridge';

/** 最小化的 EventBus mock 类型，替代 `any` */
interface MockEventBusEditor {
  eventBus: {
    on: (event: string, cb: Function) => void;
    off: (event: string, cb: Function) => void;
  };
}

describe('mountEventBridge', () => {
  let editor: MockEventBusEditor;
  let handlers: Record<string, Function>;

  beforeEach(() => {
    handlers = {};
    editor = {
      eventBus: {
        on: vi.fn((event: string, cb: Function) => {
          handlers[event] = cb;
        }),
        off: vi.fn(),
      },
    };
  });

  it('subscribes onRangeStyleChange to rangeStyleChange event', () => {
    const cb = vi.fn();
    mountEventBridge(editor as unknown as Editor, { onRangeStyleChange: cb });
    expect(editor.eventBus.on).toHaveBeenCalledWith('rangeStyleChange', cb);
  });

  it('subscribes onPageNoChange to intersectionPageNoChange event', () => {
    const cb = vi.fn();
    mountEventBridge(editor as unknown as Editor, { onPageNoChange: cb });
    expect(editor.eventBus.on).toHaveBeenCalledWith('intersectionPageNoChange', cb);
  });

  it('subscribes onPageSizeChange to pageSizeChange event', () => {
    const cb = vi.fn();
    mountEventBridge(editor as unknown as Editor, { onPageSizeChange: cb });
    expect(editor.eventBus.on).toHaveBeenCalledWith('pageSizeChange', cb);
  });

  it('subscribes onPageScaleChange to pageScaleChange event', () => {
    const cb = vi.fn();
    mountEventBridge(editor as unknown as Editor, { onPageScaleChange: cb });
    expect(editor.eventBus.on).toHaveBeenCalledWith('pageScaleChange', cb);
  });

  it('unmount removes all listeners', () => {
    const cb = vi.fn();
    const handle = mountEventBridge(editor as unknown as Editor, { onContentChange: cb });
    handle.unmount();
    expect(editor.eventBus.off).toHaveBeenCalledWith('contentChange', cb);
  });

  it('unmount removes all listeners when multiple callbacks are mounted', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    const handle = mountEventBridge(editor as unknown as Editor, {
      onRangeStyleChange: cb1,
      onContentChange: cb2,
      onPageNoChange: cb3,
    });
    handle.unmount();
    expect(editor.eventBus.off).toHaveBeenCalledTimes(3);
    expect(editor.eventBus.off).toHaveBeenCalledWith('rangeStyleChange', cb1);
    expect(editor.eventBus.off).toHaveBeenCalledWith('contentChange', cb2);
    expect(editor.eventBus.off).toHaveBeenCalledWith('intersectionPageNoChange', cb3);
  });

  it('fires callback when event triggers', () => {
    const cb = vi.fn();
    mountEventBridge(editor as unknown as Editor, { onPageNoChange: cb });
    handlers['intersectionPageNoChange']?.(3);
    expect(cb).toHaveBeenCalledWith(3);
  });

  it('skips undefined callbacks without subscribing', () => {
    mountEventBridge(editor as unknown as Editor, {});
    expect(editor.eventBus.on).not.toHaveBeenCalled();
  });
});
