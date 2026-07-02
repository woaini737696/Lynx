"use client";

import { cn } from "@/lib/utils";
import { MessageSquare, X } from "lucide-react";
import { SearchInput, Pagination, useClientPagination } from "@/components/ui/ListControls";

interface SessionItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
}

interface SessionListProps {
  sessions: SessionItem[];
  sessionQuery: string;
  setSessionQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredSessions: SessionItem[];
  sessionPagination: ReturnType<typeof useClientPagination<SessionItem>>;
  currentSessionId: string | null;
  loadSession: (sessionId: string) => Promise<void>;
  setShowSessionList: React.Dispatch<React.SetStateAction<boolean>>;
}

export function SessionList(props: SessionListProps) {
  const { sessions, sessionQuery, setSessionQuery, filteredSessions, sessionPagination, currentSessionId, loadSession, setShowSessionList } = props;
  return (
    <div className="border-b border-border bg-card/80 px-4 py-3 backdrop-blur-xl sm:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MessageSquare className="h-4 w-4 text-cognition" />
            历史对话
            <span className="text-xs font-normal text-muted-foreground">（{sessions.length}）</span>
          </h3>
          <button onClick={() => setShowSessionList(false)} className="rounded-lg p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {sessions.length > 0 && (
          <SearchInput value={sessionQuery} onChange={setSessionQuery} placeholder="搜索对话标题..." className="mb-2" />
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">暂无历史对话</p>
              <p className="text-xs text-muted-foreground/70">开始新对话后会自动保存到这里</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">未找到匹配的对话</p>
          ) : (
            sessionPagination.paginated.map((s) => (
              <button
                key={s.id}
                onClick={() => { loadSession(s.id); setShowSessionList(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/10",
                  currentSessionId === s.id ? "bg-cognition/10 text-cognition ring-1 ring-cognition/20" : "text-foreground"
                )}
              >
                <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", currentSessionId === s.id ? "text-cognition" : "text-muted-foreground")} />
                <span className="flex-1 truncate font-medium">{s.title}</span>
                <span className={cn("shrink-0 text-xs", currentSessionId === s.id ? "text-cognition/70" : "text-muted-foreground")}>{s.messageCount}条</span>
              </button>
            ))
          )}
        </div>
        {filteredSessions.length > 0 && (
          <div className="mt-2">
            <Pagination
              page={sessionPagination.page}
              pageSize={sessionPagination.pageSize}
              total={sessionPagination.total}
              onPageChange={sessionPagination.onPageChange}
              onPageSizeChange={sessionPagination.onPageSizeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
