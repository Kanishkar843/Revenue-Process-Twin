import { useQuery } from "@tanstack/react-query";
import { getRecoverableSummary } from "../api/apiClient";

export function useSummary() {
  return useQuery({
    queryKey: ["summary"],
    queryFn: getRecoverableSummary,
  });
}
