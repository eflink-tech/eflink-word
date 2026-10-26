import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@eflink-tech/office-kit';

interface ShortcutItem {
  actionKey: string;
  win: string;
  mac: string;
}

const SHORTCUT_GROUPS: { categoryKey: string; items: ShortcutItem[] }[] = [
  {
    categoryKey: 'word.shortcuts.categoryFile',
    items: [
      { actionKey: 'word.menu.newDoc', win: 'Ctrl + N', mac: '⌘ + N' },
      { actionKey: 'action.saveToBrowser', win: 'Ctrl + S', mac: '⌘ + S' },
      { actionKey: 'action.print', win: 'Ctrl + P', mac: '⌘ + P' },
    ],
  },
  {
    categoryKey: 'word.shortcuts.categoryEdit',
    items: [
      { actionKey: 'action.undo', win: 'Ctrl + Z', mac: '⌘ + Z' },
      { actionKey: 'action.redo', win: 'Ctrl + Y', mac: '⌘ + Shift + Z' },
      { actionKey: 'word.tb.bold', win: 'Ctrl + B', mac: '⌘ + B' },
      { actionKey: 'word.tb.italic', win: 'Ctrl + I', mac: '⌘ + I' },
      { actionKey: 'word.tb.underline', win: 'Ctrl + U', mac: '⌘ + U' },
      { actionKey: 'word.tb.strike', win: 'Ctrl + Shift + X', mac: '⌘ + Shift + X' },
    ],
  },
  {
    categoryKey: 'word.shortcuts.categoryFormat',
    items: [
      { actionKey: 'word.align.left', win: 'Ctrl + Shift + L', mac: '⌘ + Shift + L' },
      { actionKey: 'word.align.center', win: 'Ctrl + Shift + E', mac: '⌘ + Shift + E' },
      { actionKey: 'word.align.right', win: 'Ctrl + Shift + R', mac: '⌘ + Shift + R' },
      { actionKey: 'word.align.justify', win: 'Ctrl + Shift + J', mac: '⌘ + Shift + J' },
    ],
  },
  {
    categoryKey: 'word.shortcuts.categoryFind',
    items: [
      { actionKey: 'action.find', win: 'Ctrl + F', mac: '⌘ + F' },
      { actionKey: 'word.shortcuts.replace', win: 'Ctrl + H', mac: '⌘ + H' },
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
  const { t } = useI18n();
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
        aria-label={t('word.shortcuts.title')}
        tabIndex={-1}
        className="w-[480px] max-h-[70vh] overflow-y-auto rounded-md border border-[#e7e9eb] bg-white shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7e9eb] bg-white px-5 py-3">
          <span className="text-[15px] font-medium text-[#1f2329]">{t('word.shortcuts.title')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('action.close')}
            className="flex h-7 w-7 items-center justify-center rounded-[2px] text-[#51565f] hover:bg-[#f2f3f4]"
          >
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.categoryKey} className="mb-4">
              <div className="mb-2 text-[13px] font-medium text-[#1f2329]">{t(group.categoryKey)}</div>
              {group.items.map((item) => (
                <div
                  key={item.actionKey}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="text-[13px] text-[#51565f]">{t(item.actionKey)}</span>
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
