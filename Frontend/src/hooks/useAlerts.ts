import { useQuery } from "@tanstack/react-query";
import { getAlerts } from "../api/apiClient";

export interface AlertFilters {
  page?: number;
  page_size?: number;
  severity?: string;
  status?: string;
  customer_id?: string;
}

export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => getAlerts(filters),
  });
}
