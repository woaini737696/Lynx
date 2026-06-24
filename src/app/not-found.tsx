import Link from "next/link";
import { Home, Compass } from "lucide-react";

/**
 * 404 页面 - 路由未匹配时显示
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-cognition/10">
        <Compass className="h-10 w-10 text-cognition" />
      </div>
      <h1 className="mb-2 text-6xl font-bold text-foreground">404</h1>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        页面未找到
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        你访问的页面不存在或已被移动。请检查地址是否正确，或返回首页继续浏览。
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Home className="h-4 w-4" /> 返回首页
      </Link>
    </div>
  );
}
