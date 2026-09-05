import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ShortcutItem {
  action: string;
  win: string;
  mac: string;
}

const SHORTCUT_GROUPS: { category: string; items: ShortcutItem[] }[] = [
  {
    category: '文件',
    items: [
      { action: '新建文档', win: 'Ctrl + N', mac: '⌘ + N' },
      { action: '保存到浏览器', win: 'Ctrl + S', mac: '⌘ + S' },
      { action: '打印', win: 'Ctrl + P', mac: '⌘ + P' },
    ],
  },
  {
    category: '编辑',
    items: [
      { action: '撤销', win: 'Ctrl + Z', mac: '⌘ + Z' },
      { action: '重做', win: 'Ctrl + Y', mac: '⌘ + Shift + Z' },
      { action: '加粗', win: 'Ctrl + B', mac: '⌘ + B' },
      { action: '斜体', win: 'Ctrl + I', mac: '⌘ + I' },
      { action: '下划线', win: 'Ctrl + U', mac: '⌘ + U' },
      { action: '删除线', win: 'Ctrl + Shift + X', mac: '⌘ + Shift + X' },
    ],
  },
  {
    category: '格式',
    items: [
      { action: '左对齐', win: 'Ctrl + Shift + L', mac: '⌘ + Shift + L' },
      { action: '居中对齐', win: 'Ctrl + Shift + E', mac: '⌘ + Shift + E' },
      { action: '右对齐', win: 'Ctrl + Shift + R', mac: '⌘ + Shift + R' },
      { action: '两端对齐', win: 'Ctrl + Shift + J', mac: '⌘ + Shift + J' },
    ],
  },
  {
    category: '查找',
    items: [
      { action: '查找', win: 'Ctrl + F', mac: '⌘ + F' },
      { action: '替换', win: 'Ctrl + H', mac: '⌘ + H' },
    ],
  },
];

function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

interface ShortcutsDialogProps {
  onClose: () => void;
}

/** 快捷键列表弹窗 */
export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const mac = isMac();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="快捷键"
        tabIndex={-1}
        className="w-[480px] max-h-[70vh] overflow-y-auto rounded-md border border-[#e7e9eb] bg-white shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7e9eb] bg-white px-5 py-3">
          <span className="text-[15px] font-medium text-[#1f2329]">快捷键</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-7 w-7 items-center justify-center rounded-[2px] text-[#51565f] hover:bg-[#f2f3f4]"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="mb-4">
              <div className="mb-2 text-[13px] font-medium text-[#1f2329]">{group.category}</div>
              {group.items.map((item) => (
                <div
                  key={item.action}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-[13px] text-[#51565f]">{item.action}</span>
                  <kbd className="rounded border border-[#e7e9eb] bg-[#f5f6f7] px-2 py-0.5 font-mono text-[12px] text-[#51565f]">
                    {mac ? item.mac : item.win}
                  </kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
