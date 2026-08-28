import type { AlertStatus } from "../../types/interfaces";
import { formatLabel } from "../../lib/format";

interface Props {
  status: AlertStatus;
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`badge badge-${status}`}>
      {formatLabel(status)}
    </span>
  );
}
