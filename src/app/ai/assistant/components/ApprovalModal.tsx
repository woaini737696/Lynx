"use client";

import { ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import type { ApprovalRequest } from "@/lib/desktop-client";

interface ApprovalModalProps {
  desktopMode: boolean;
  showApproval: boolean;
  currentApproval: ApprovalRequest | null;
  handleApprovalResponse: (approved: boolean) => Promise<void>;
}

export function ApprovalModal({ desktopMode, showApproval, currentApproval, handleApprovalResponse }: ApprovalModalProps) {
  if (!desktopMode) return null;
  return (
    <Modal
      open={showApproval}
      onClose={() => handleApprovalResponse(false)}
      title="Lynx Agent 操作审批"
      size="md"
    >
      {currentApproval && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              currentApproval.level === "L3"
                ? "bg-graveyard/15 text-graveyard"
                : "bg-campaign/15 text-campaign"
            }`}>
              {currentApproval.level === "L3" ? <ShieldOff className="h-2.5 w-2.5" /> : <ShieldAlert className="h-2.5 w-2.5" />}
              {currentApproval.level} 级操作
            </span>
            <span className="text-xs text-muted-foreground">
              {currentApproval.level === "L3" ? "高风险（每次需审批）" : "中风险（首次授权）"}
            </span>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="mb-1 text-xs font-medium text-foreground">操作描述</div>
            <div className="text-xs text-foreground">{currentApproval.action}</div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="mb-1 text-xs font-medium text-foreground">执行命令</div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded bg-background p-2 text-xs text-foreground">
              {currentApproval.command}
            </pre>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-yellow-300/30 bg-yellow-50/40 p-2 text-xs text-yellow-700">
            <ShieldCheck className="h-3 w-3 shrink-0" />
            请确认是否允许执行此操作。拒绝将中止该操作但可继续对话。
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => handleApprovalResponse(false)} className="gap-1.5">
              拒绝
            </Button>
            <Button size="sm" variant="primary" onClick={() => handleApprovalResponse(true)} className="gap-1.5">
              <ShieldCheck className="h-3 w-3" /> 批准执行
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
