import useSWR from "swr";
import { fetcher } from "./swr-config";

// 灵感列表
export function useIdeas() {
  return useSWR("/api/ideas", fetcher);
}

// 任务列表
export function useTasks() {
  return useSWR("/api/tasks", fetcher);
}

// 认知列表
export function useCognitions() {
  return useSWR("/api/cognitions", fetcher);
}

// 记忆图谱
export function useMemory() {
  return useSWR("/api/memory", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  });
}

// 巡检规则
export function usePatrolRules() {
  return useSWR("/api/patrol/rules", fetcher);
}

// 对话列表
export function useConversations() {
  return useSWR("/api/conversations", fetcher);
}

// 技能列表
export function useSkills() {
  return useSWR("/api/skills", fetcher);
}

// 角色列表
export function useRoles() {
  return useSWR("/api/admin/roles", fetcher);
}
