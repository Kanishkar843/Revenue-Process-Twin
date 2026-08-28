import { useQuery } from "@tanstack/react-query";
import { getCustomerExplain } from "../api/apiClient";

export function useCustomerExplain(id: string) {
  return useQuery({
    queryKey: ["customer-explain", id],
    queryFn: () => getCustomerExplain(id),
    enabled: !!id,
  });
}
