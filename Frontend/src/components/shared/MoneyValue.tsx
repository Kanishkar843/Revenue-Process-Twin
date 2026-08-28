import { formatINR } from "../../lib/format";

interface Props {
  value: number;
  accent?: boolean;
  className?: string;
}

/** Renders a money value using the single INR formatter. */
export function MoneyValue({ value, accent = false, className }: Props) {
  return (
    <span className={`${accent ? "money-accent" : "money-normal"} ${className ?? ""}`}>
      {formatINR(value)}
    </span>
  );
}
