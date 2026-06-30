import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界：捕获子组件渲染异常，避免整个应用白屏
 * 显示错误信息 + 重试按钮
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("页面渲染异常:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">页面渲染失败</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error?.message || "发生未知错误"}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }
}
