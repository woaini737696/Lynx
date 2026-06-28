interface LogoProps {
  className?: string;
  variant?: "dark" | "light";
}

/**
 * Lynx 产品 Logo - 对齐 Web端，使用 PNG 资源（黑色底 + 白色猞猁）
 * 资源：/lynx-icon-128.png（与 Web端 public/lynx-icon-128.png 一致）
 */
export function Logo({ className = "w-8 h-8", variant = "dark" }: LogoProps) {
  // Web端 logo 黑底白猞猁，深浅色主题一致
  return (
    <img
      src="/lynx-icon-128.png"
      alt="Lynx"
      className={className}
      draggable={false}
    />
  );
}
