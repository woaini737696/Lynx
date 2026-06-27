export type AgentInstallState = "unknown" | "not_installed" | "installing" | "installed" | "starting" | "running" | "error";

export interface AgentLogEntry {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
}
