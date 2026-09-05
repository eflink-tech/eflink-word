import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';

interface SearchPanelProps {
  editor: Editor | null;
  onClose: () => void;
}

/** 查找替换面板（基于 canvas-editor 搜索 API） */
export function SearchPanel({ editor, onClose }: SearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [resultText, setResultText] = useState('');

  // StrictMode 下 effects 会「挂载 → 清理 → 重新挂载」且 ref 值保留，
  // 必须在 effect 体里重新置 true，否则清理置 false 后 safeSetTimeout 永远丢弃回调
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 安全的 setTimeout：组件卸载后不执行回调
  const safeSetTimeout = (fn: () => void, ms: number) => {
    setTimeout(() => {
      if (mountedRef.current) fn();
    }, ms);
  };

  // 同步搜索结果数量；term 为触发本次同步的查找词（避免读到过期 state）
  // getSearchNavigateInfo().index 为 1-based 当前匹配序号，0 表示尚未导航定位
  const syncResults = (term: string) => {
    if (!editor) return;
    const info = editor.command.getSearchNavigateInfo();
    if (!info || info.count === 0) {
      setResultText(term ? '无结果' : '');
    } else if (info.index > 0) {
      setResultText(`${info.index}/${info.count}`);
    } else {
      setResultText(`${info.count} 处`);
    }
  };

  // 关闭时清除高亮
  const handleClose = () => {
    editor?.command.executeSearch(null);
    onClose();
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (!editor) return;
    editor.command.executeSearch(value || null);
    // 延迟同步以等待搜索结果更新
    safeSetTimeout(() => syncResults(value), 0);
  };

  // 替换当前匹配：canvas-editor 不传 index 会替换全部，须显式传当前匹配下标
  // （getSearchNavigateInfo().index 为 1-based，replace 的 option.index 为 0-based；0 表示未导航定位，取首处）
  const handleReplace = () => {
    if (!editor || !searchTerm) return;
    const info = editor.command.getSearchNavigateInfo();
    editor.command.executeReplace(replaceTerm, { index: info && info.index > 0 ? info.index - 1 : 0 });
    safeSetTimeout(() => syncResults(searchTerm), 0);
  };

  // 全部替换：executeReplace 不传 index 即一次替换全部匹配（同步完成）
  const handleReplaceAll = () => {
    if (!editor || !searchTerm) return;
    editor.command.executeReplace(replaceTerm);
    safeSetTimeout(() => syncResults(searchTerm), 0);
  };

  const handleNavigateNext = () => {
    editor?.command.executeSearchNavigateNext();
    safeSetTimeout(() => syncResults(searchTerm), 0);
  };

  const handleNavigatePrev = () => {
    editor?.command.executeSearchNavigatePre();
    safeSetTimeout(() => syncResults(searchTerm), 0);
  };

  const inputClass =
    'h-7 w-full rounded border border-slate-200 px-2 text-[13px] text-slate-700 outline-none focus:border-blue-400';

  return (
    <div
      className="no-print absolute right-4 top-14 z-[200] w-[280px] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">查找与替换</span>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <input
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleNavigateNext();
            }
          }}
          placeholder="查找内容"
          autoFocus
          className={inputClass}
        />
        <span className="w-[52px] shrink-0 text-center text-[11px] text-slate-500">{resultText}</span>
        <button
          type="button"
          onClick={handleNavigatePrev}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          title="上一个"
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          onClick={handleNavigateNext}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          title="下一个"
        >
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <input
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleReplace();
            }
          }}
          placeholder="替换为"
          className={inputClass}
        />
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={handleReplace}
          disabled={!searchTerm}
          className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          替换
        </button>
        <button
          type="button"
          onClick={handleReplaceAll}
          disabled={!searchTerm}
          className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          全部替换
        </button>
      </div>
    </div>
  );
}
