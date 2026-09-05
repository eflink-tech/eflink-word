// 列表按钮组（无序/有序/任务）
// Task 2.3：已从 TipTap 迁移到 canvas-editor executeList API
// 注意：canvas-editor ListType 只有 UL/OL，任务列表通过 ListStyle.CHECKBOX 实现
import { List, ListOrdered, ListChecks, type LucideIcon } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';
import { ListType, ListStyle } from '@hufe921/canvas-editor';
import type { IRangeStyle } from '@hufe921/canvas-editor';

interface ListGroupProps {
  editor: Editor | null;
  listType: ListType | null;
  listStyle: ListStyle | null;
}

interface ListBtnProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}

function ListBtn({ icon: Icon, label, onClick, active = false }: ListBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

export function ListGroup({ editor, listType, listStyle }: ListGroupProps) {
  const isBullet = listType === ListType.UL && listStyle !== ListStyle.CHECKBOX;
  const isOrdered = listType === ListType.OL;
  const isTask = listType === ListType.UL && listStyle === ListStyle.CHECKBOX;

  const toggle = (kind: 'bullet' | 'ordered' | 'task') => {
    if (!editor) return;
    switch (kind) {
      case 'bullet':
        // 若已是 bullet，再次调用取消；否则设置为 disc
        if (isBullet) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.UL, ListStyle.DISC);
        }
        break;
      case 'ordered':
        if (isOrdered) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.OL, ListStyle.DECIMAL);
        }
        break;
      case 'task':
        // canvas-editor 任务列表以 ListStyle.CHECKBOX 表达
        if (isTask) {
          editor.command.executeList(null);
        } else {
          editor.command.executeList(ListType.UL, ListStyle.CHECKBOX);
        }
        break;
    }
  };

  return (
    <div className="flex shrink-0 items-center">
      <ListBtn
        icon={List}
        label="无序"
        onClick={() => toggle('bullet')}
        active={isBullet}
      />
      <ListBtn
        icon={ListOrdered}
        label="有序"
        onClick={() => toggle('ordered')}
        active={isOrdered}
      />
      <ListBtn
        icon={ListChecks}
        label="任务"
        onClick={() => toggle('task')}
        active={isTask}
      />
    </div>
  );
}

// 工具函数：从 rangeStyle 读取当前列表状态
export function readListFromRange(rangeStyle: IRangeStyle | null): {
  listType: ListType | null;
  listStyle: ListStyle | null;
} {
  return {
    listType: rangeStyle?.listType ?? null,
    listStyle: rangeStyle?.listStyle ?? null,
  };
}
