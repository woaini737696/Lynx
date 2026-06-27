"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useCallback } from "react";
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
 * - prefetch 预加载路由 chunk
 * - 鼠标悬停时再次预热
 * - pointer down 阶段即开始导航，比 click 提前约 80~120ms
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
  const navigatedRef = useRef(false);

  const warmup = useCallback(() => {
    try {
      router.prefetch(href);
    } catch {
      // ignore
    }
  }, [router, href]);

  const navigate = useCallback(
    (e?: React.MouseEvent | React.PointerEvent) => {
      // 保留中键/新标签页行为
      if (e && (e.ctrlKey || e.metaKey || e.button !== 0)) return;
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      e?.preventDefault?.();
      onClick?.();
      router.push(href);
      // 重置标记，允许返回后再次点击
      setTimeout(() => {
        navigatedRef.current = false;
      }, 200);
    },
    [href, onClick, router]
  );

  return (
    <Link
      href={href}
      prefetch
      title={title}
      aria-label={ariaLabel}
      className={cn(className)}
      onMouseEnter={warmup}
      onPointerDown={navigate}
      onClick={navigate}
    >
      {children}
    </Link>
  );
}
