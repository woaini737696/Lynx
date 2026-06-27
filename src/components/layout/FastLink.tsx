"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface FastLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
  ariaLabel?: string;
}

/**
 * 快速导航链接
 * - 默认开启 prefetch，鼠标悬停时进一步预热路由
 * - 配合 RouteProgress 提供即时响应的桌面应用体验
 */
export function FastLink({
  href,
  children,
  className,
  onClick,
  title,
  ariaLabel,
}: FastLinkProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch
      title={title}
      aria-label={ariaLabel}
      className={cn(className)}
      onMouseEnter={() => {
        try {
          router.prefetch(href);
        } catch {
          // ignore
        }
      }}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
          router.push(href);
        }
      }}
    >
      {children}
    </Link>
  );
}
