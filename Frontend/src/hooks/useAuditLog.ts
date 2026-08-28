import { useState } from "react";
import type { AuditLogEntry } from "../types/interfaces";

const seedLog: AuditLogEntry[] = [];

/** In-session audit log: seed from mock, append live executions. */
export function useAuditLog() {
  const [log, setLog] = useState<AuditLogEntry[]>(seedLog);

  function appendEntry(entry: AuditLogEntry) {
    setLog((prev) => [entry, ...prev]);
  }

  return { log, appendEntry };
}
