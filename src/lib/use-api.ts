import useSWR from "swr";
import { fetcher } from "@/components/providers/SWRProvider";

// 认知列表
export function useCognitions() {
  return useSWR("/api/cognitions", fetcher);
}
