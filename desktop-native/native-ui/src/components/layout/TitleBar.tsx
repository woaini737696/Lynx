import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = isTauri() ? getCurrentWebviewWindow() : null;

  useEffect(() => {
    if (!appWindow) return;
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [appWindow]);

  const handleMinimize = () => appWindow?.minimize();
  const handleMaximize = async () => {
    if (!appWindow) return;
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  const handleClose = () => appWindow?.close();

  return (
    <header
      data-tauri-drag-region
      className="glass-bar flex h-11 w-full shrink-0 items-center justify-between px-3 select-none"
    >
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <Logo className="h-6 w-6 rounded-lg" variant="dark" />
        <span className="text-sm font-semibold tracking-tight text-foreground/90">Lynx</span>
      </div>

      <div className="flex items-center" data-tauri-drag-region>
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
    >
      {children}
    </button>
  );
}
