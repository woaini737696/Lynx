import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { isTauri, isElectron } from "@/lib/tauri";

// Electron 窗口拖动：通过 CSS -webkit-app-region: drag 实现
// Tauri 窗口拖动：通过 data-tauri-drag-region 属性实现
// 两者都加上，兼容双模式

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = isTauri() ? getCurrentWebviewWindow() : null;
  const electronWindow = isElectron() ? (window as any).electronAPI.window : null;

  useEffect(() => {
    if (appWindow) {
      let unlisten: (() => void) | undefined;
      appWindow.onResized(async () => {
        setIsMaximized(await appWindow.isMaximized());
      }).then((fn) => {
        unlisten = fn;
      });
      return () => unlisten?.();
    }
    if (electronWindow) {
      const unlisten = electronWindow.onMaximizeChange((maximized: boolean) => {
        setIsMaximized(maximized);
      });
      return () => unlisten?.();
    }
  }, [appWindow, electronWindow]);

  const handleMinimize = () => {
    appWindow?.minimize() ?? electronWindow?.minimize();
  };
  const handleMaximize = async () => {
    if (appWindow) {
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    } else if (electronWindow) {
      electronWindow.toggleMaximize();
      setIsMaximized(await electronWindow.isMaximized());
    }
  };
  const handleClose = () => {
    appWindow?.close() ?? electronWindow?.close();
  };

  // 非 Tauri 且非 Electron 环境不显示窗口控制按钮（纯 Web 模式）
  const showWindowControls = appWindow || electronWindow;

  return (
    <header
      data-tauri-drag-region
      className="glass-bar flex h-11 w-full shrink-0 items-center justify-between px-3 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2.5" data-tauri-drag-region style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        <Logo className="h-6 w-6 rounded-lg" />
        <span className="text-sm font-semibold tracking-tight text-foreground/90">奇思</span>
      </div>

      {showWindowControls && (
        <div className="flex items-center" data-tauri-drag-region style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
          <WindowControlButton onClick={handleMinimize} label="最小化">
            <Minus className="h-4 w-4" />
          </WindowControlButton>
          <WindowControlButton onClick={handleMaximize} label={isMaximized ? "还原" : "最大化"}>
            {isMaximized ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </WindowControlButton>
          <WindowControlButton onClick={handleClose} label="关闭" className="hover:bg-destructive hover:text-destructive-foreground">
            <X className="h-4 w-4" />
          </WindowControlButton>
        </div>
      )}
    </header>
  );
}

function WindowControlButton({
  children,
  onClick,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-11 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-primary/10 hover:text-foreground",
        className
      )}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {children}
    </button>
  );
}
