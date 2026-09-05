import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import type Editor from '@hufe921/canvas-editor';

interface SearchPanelProps {
  editor: Editor | null;
  onClose: () => void;
}

/** 全部替换最大迭代次数：防止无限循环的安全阈值 */
const MAX_REPLACE_ITERATIONS = 1000;

/** 查找替换面板（对应旧系统 search__collapse，基于 canvas-editor 搜索 API） */
export function SearchPanel({ editor, onClose }: SearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [resultText, setResultText] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);

  const mountedRef = useRef(true);
  const cancelReplaceRef = useRef(false);
  useEffect(() => {
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

  // 同步搜索结果数量
  const syncResults = () => {
    if (!editor) return;
    const info = editor.command.getSearchNavigateInfo();
    if (!info || info.count === 0) {
      setResultText(searchTerm ? '无结果' : '');
    } else {
      setResultText(`${info.index + 1}/${info.count}`);
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
    if (value) {
      editor.command.executeSearch(value);
    } else {
      editor.command.executeSearch(null);
    }
    // 延迟同步以等待搜索结果更新
    safeSetTimeout(syncResults, 0);
  };

  const handleReplace = () => {
    if (!editor) return;
    editor.command.executeReplace(replaceTerm);
    safeSetTimeout(syncResults, 0);
  };

  const handleReplaceAll = () => {
    if (!editor || !searchTerm || isReplacing) return;
    setIsReplacing(true);
    cancelReplaceRef.current = false;
    let iterations = 0;
    const doReplace = () => {
      if (!mountedRef.current || cancelReplaceRef.current) {
        setIsReplacing(false);
        return;
      }
      const info = editor.command.getSearchNavigateInfo();
      if (!info || info.count === 0 || iterations >= MAX_REPLACE_ITERATIONS) {
        syncResults();
        setIsReplacing(false);
        return;
      }
      editor.command.executeReplace(replaceTerm);
      iterations++;
      safeSetTimeout(doReplace, 0);
    };
    doReplace();
  };

  const handleCancelReplace = useCallback(() => {
    cancelReplaceRef.current = true;
  }, []);

  const handleNavigateNext = () => {
    editor?.command.executeSearchNavigateNext();
    safeSetTimeout(syncResults, 0);
  };

  const handleNavigatePrev = () => {
    editor?.command.executeSearchNavigatePre();
    safeSetTimeout(syncResults, 0);
  };

  const inputClass =
    'h-7 w-full rounded border border-slate-200 px-2 text-[13px] text-slate-700 outline-none focus:border-blue-400';

  return (
    <div
      className="no-print absolute right-4 top-14 z-[200] w-[280px] rounded-md border border-slate-200 bg-white p-3 shadow-lg"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (isReplacing) {
            handleCancelReplace();
          } else {
            handleClose();
          }
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
        {isReplacing ? (
          <button
            type="button"
            onClick={handleCancelReplace}
            className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
          >
            取消
          </button>
        ) : (
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={!searchTerm}
            className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            全部替换
          </button>
        )}
      </div>
    </div>
  );
}
