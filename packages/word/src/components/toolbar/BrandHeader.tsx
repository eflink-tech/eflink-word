// 顶部标题栏（左侧区）：品牌 logo + 产品名（经 WordEditor 的 branding props 注入）
// 中间为居中的工具栏（见 WordEditor 布局）
export interface BrandHeaderProps {
  logo?: string;
  name: string;
}

export function BrandHeader({ logo, name }: BrandHeaderProps) {
  return (
    <div className="flex shrink-0 items-center">
      {logo && <img src={logo} alt="" className="mr-2 h-6 w-6 shrink-0 rounded-full" />}
      <span className="shrink-0 text-[15px] font-semibold text-[#1f2329]">{name}</span>
    </div>
  );
}
