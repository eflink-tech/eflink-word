// 格式刷 hook：委托 canvas-editor 原生 painter 命令（单击一次 / 双击连续）
// 原 TipTap 版本包含采样、应用、Esc 退出等手动逻辑；canvas-editor 已内部处理
import { useCallback } from 'react';
import type Editor from '@hufe921/canvas-editor';
import { useEditorStore } from '../store/editorStore';

export type PainterMode = 'off' | 'once' | 'continuous';

export function useFormatPainter(editor: Editor | null) {
  const { rangeStyle } = useEditorStore();

  // canvas-editor IRangeStyle.painter: boolean 表示是否处于格式刷模式
  // 注意：canvas-editor 不区分 once/continuous，统一视为 active；
  // 这里将 active 显示为 'once'（按钮高亮态），title 文案由 Toolbar 另行处理
  const mode: PainterMode = rangeStyle?.painter ? 'once' : 'off';

  const onPainterClick = useCallback(() => {
    editor?.command.executePainter({ isDblclick: false });
  }, [editor]);

  const onPainterDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      editor?.command.executePainter({ isDblclick: true });
    },
    [editor],
  );

  // canvas-editor 内部处理鼠标交互（采样 + 应用），无需外部 mousedown 钩子
  const onPainterMouseDown = undefined;

  return { mode, onPainterClick, onPainterDoubleClick, onPainterMouseDown };
}
