import { HermesPanel } from "@/components/agent/HermesPanel";
import { HelpButton } from "@/components/ui/HelpButton";

export function AgentPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">HermesAgent</h1>
          <p className="mt-1 text-sm text-muted-foreground">本地超级助理 · 一键安装 · 本地部署</p>
        </div>
        <HelpButton module="agent" />
      </div>
      <HermesPanel />
    </div>
  );
}
