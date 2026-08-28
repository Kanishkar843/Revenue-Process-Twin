import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/apiClient";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000, // poll every 30 seconds
    staleTime: 25_000,
  });
}
