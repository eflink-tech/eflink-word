// 顶部标题栏（左侧区）：返回按钮（宿主注入时）+ 品牌 logo + 产品名（经 WordEditor 的 branding props 注入）
// 中间为居中的工具栏（见 WordEditor 布局）
import { ArrowLeft } from 'lucide-react';
import { getEditorBackHref } from '../../core/chrome';

export interface BrandHeaderProps {
  logo?: string;
  name: string;
}

export function BrandHeader({ logo, name }: BrandHeaderProps) {
  const backHref = getEditorBackHref();
  return (
    <div className="flex shrink-0 items-center">
      {backHref && (
        <a
          href={backHref}
          title="返回"
          className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-[#646a73] transition-colors hover:bg-[#f2f3f5] hover:text-[#1f2329]"
        >
          <ArrowLeft size={18} />
        </a>
      )}
      {logo && <img src={logo} alt="" className="mr-2 h-6 w-6 shrink-0 rounded-full" />}
      <span className="shrink-0 text-[15px] font-semibold text-[#1f2329]">{name}</span>
    </div>
  );
}
