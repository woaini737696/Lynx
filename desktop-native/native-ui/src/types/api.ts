export interface FocusItem {
  id: string;
  taskId: string;
  title: string;
  column: "northstar" | "campaign" | "task";
  completed: boolean;
}

export interface DailyFocus {
  id: string;
  date: string;
  status: string;
  items: FocusItem[];
}

export interface BoardTask {
  id: string;
  content: string;
  column: "northstar" | "campaign" | "task";
  status: "active" | "done" | "dropped";
  position: number;
  sourceId?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface AgentStatus {
  version: string;
  wsConnected: boolean;
  cloudEndpoint: string;
  authMode: string;
  authorizedDirs: string[];
  capabilities: string[];
  hasToken: boolean;
}

export interface Attachment {
  type: "image" | "file";
  name: string;
  url: string;
  size?: number;
}

export interface Idea {
  id: string;
  content: string;
  source: string;
  status?: "inbox" | "board" | "graveyard";
  tags: string[];
  attachments?: Attachment[];
  createdAt: string;
}

export interface ReviveSuggestion {
  graveyardId: string;
  originalContent: string;
  reviveCondition: string;
  reason: string;
  matchedContent?: string;
  matchedIdeaId?: string;
}

export interface FinalizeResult {
  idea: Idea;
  cognition?: { id: string; type: string; content: string } | null;
  summary: string;
  tags: string[];
  suggestedColumn: string;
  reason: string;
}

export interface Cognition {
  id: string;
  type: "method" | "experience" | "prompt";
  content: string;
  source: string;
  tags: string[];
  createdAt: string;
}

export interface GraveyardItem {
  id: string;
  ideaId: string;
  content: string;
  reason: string;
  reviveCondition: string;
  revivedAt?: string | null;
  createdAt: string;
  abandonedAt: string;
}
