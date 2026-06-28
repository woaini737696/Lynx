"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * 路由切换顶部进度条
 * - 路径变化时立即显示，300ms 内完成动画
 * - 路径稳定后快速结束，提供"即时响应"的感知反馈
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 立即显示并开始增长
    setVisible(true);
    setProgress(30);

    if (timerRef.current) clearTimeout(timerRef.current);

    // 100ms 内拉到 60%，模拟快速加载
    const step1 = setTimeout(() => setProgress(60), 80);

    // 300ms 后进入完成阶段
    timerRef.current = setTimeout(() => {
      setProgress(100);
      // 动画结束后隐藏
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = setTimeout(() => setProgress(0), 150);
      }, 250);
    }, 300);

    return () => {
      clearTimeout(step1);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, searchParams]);

  return (
    <div
      className={cn(
        "fixed left-0 top-0 z-[100] h-[2px] w-full pointer-events-none transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
      aria-hidden="true"
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.8)] transition-[width] ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? "250ms" : progress <= 30 ? "80ms" : "200ms",
        }}
      />
    </div>
  );
}
