/** 状态栏纸张相关图标 — 与旧版易飞文档底部工具栏一致 */

interface IconProps {
  size?: number;
  className?: string;
}

/** 纸张类型：折角纸张 + 对角双向箭头 */
export function PaperSizeIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M3.5 2.5h6.2L12.5 5.3V13.5H3.5V2.5z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <path
        d="M9.7 2.5V5.3H12.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      {/* 对角双向箭头 */}
      <path
        d="M5.2 10.8L9.2 6.8"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path
        d="M5.2 10.8l1.1-0.3M5.2 10.8l0.3-1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 6.8l-1.1 0.3M9.2 6.8l-0.3 1.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 纸张方向：纵向 + 横向叠放 */
export function PaperDirectionIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* 后方纵向页 */}
      <rect
        x="2"
        y="1.5"
        width="5.5"
        height="8.5"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      {/* 前方横向页 */}
      <rect
        x="6"
        y="6"
        width="8"
        height="5.5"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="1.15"
        fill="#f5f6f7"
      />
    </svg>
  );
}

/** 页边距：外框 + 内框 */
export function PageMarginIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <rect
        x="5"
        y="5"
        width="6"
        height="6"
        rx="0.4"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  );
}
