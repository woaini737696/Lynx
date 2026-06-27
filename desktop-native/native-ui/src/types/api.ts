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
