import { useRef } from "react";
import { Globe } from "lucide-react";

export function WebFallbackPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cloudUrl = "https://app.lynnhub.com";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Web 兼容模式</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            该页面尚未完成原生重构，暂时嵌入 Web 端提供完整功能
          </p>
        </div>
        <a
          href={cloudUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/15"
        >
          <Globe className="h-4 w-4" />
          在浏览器打开
        </a>
      </div>
      <div className="glass-card flex flex-1 overflow-hidden p-1">
        <iframe
          ref={iframeRef}
          src={cloudUrl}
          className="h-full w-full rounded-[1rem] border-0"
          title="Lynx Web Fallback"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
