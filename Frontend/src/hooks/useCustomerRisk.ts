import { useQuery } from "@tanstack/react-query";
import { getCustomerRisk } from "../api/apiClient";

export function useCustomerRisk(id: string) {
  return useQuery({
    queryKey: ["customer-risk", id],
    queryFn: () => getCustomerRisk(id),
    enabled: !!id,
  });
}
