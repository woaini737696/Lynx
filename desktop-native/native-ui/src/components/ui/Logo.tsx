interface LogoProps {
  className?: string;
}

/**
 * Lynx 产品 Logo - 对齐 Web端，使用 PNG 资源（黑色底 + 白色猞猁）
 * 资源：lynx-icon-128.png（与 Web端 public/lynx-icon-128.png 一致）
 * P0 修复：绝对路径 /lynx-icon-128.png 在 Electron file:// 协议下解析为文件系统根目录
 */
export function Logo({ className = "w-8 h-8" }: LogoProps) {
  return (
    <img
      src="./lynx-icon-128.png"
      alt="Lynx"
      className={className}
      draggable={false}
    />
  );
}
