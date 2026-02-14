const counters: Record<string, number> = {};

function inc(key: string, amount: number = 1): void {
  counters[key] = (counters[key] ?? 0) + amount;
}

export function getCounters(): Record<string, number> {
  return { ...counters };
}

export function resetCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}

export function countAuditAppend(success: boolean): void {
  inc(success ? "audit.append.ok" : "audit.append.fail");
}

export function countAuditVerify(status: "ok" | "partial" | "broken" | "empty"): void {
  inc(`audit.verify.${status}`);
}

export function countPolicyViolation(observationType: string): void {
  inc(`policy.violation.${observationType}`);
  inc("policy.violation.total");
}

export function countAdapterError(provider: string): void {
  inc(`adapter.error.${provider}`);
  inc("adapter.error.total");
}

export function countRequest(method: string, path: string, status: number): void {
  const bucket = path.replace(/\/[a-f0-9-]{36}/g, "/:id").replace(/\/\d+/g, "/:n");
  inc(`http.${method}.${bucket}.${status}`);
}

export function countRateLimit(endpoint: string): void {
  inc(`ratelimit.${endpoint}`);
  inc("ratelimit.total");
}

interface StructuredLog {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  [key: string]: unknown;
}

function emit(log: StructuredLog): void {
  console.log(JSON.stringify(log));
}

export function logAuditAppendOk(seq: number, action: string): void {
  countAuditAppend(true);
  emit({ ts: new Date().toISOString(), level: "info", event: "audit.append", seq, action });
}

export function logAuditAppendFail(action: string, error: string): void {
  countAuditAppend(false);
  emit({ ts: new Date().toISOString(), level: "error", event: "audit.append.fail", action, error });
}

export function logAuditVerifyResult(status: string, checked: number, total: number): void {
  const bucket = status === "BROKEN" ? "broken" : status === "EMPTY" ? "empty" : checked < total ? "partial" : "ok";
  countAuditVerify(bucket as any);
  emit({ ts: new Date().toISOString(), level: status === "BROKEN" ? "warn" : "info", event: "audit.verify", status, checked, total });
}

export function logPolicyViolation(observationType: string, provider: string, violations: number): void {
  countPolicyViolation(observationType);
  emit({ ts: new Date().toISOString(), level: "warn", event: "policy.violation", observationType, provider, violations });
}

export function logAdapterError(provider: string, code: string, message: string): void {
  countAdapterError(provider);
  emit({ ts: new Date().toISOString(), level: "error", event: "adapter.error", provider, code, message });
}

export function logReadyCheck(ms: number, status: string, dbOk: boolean, auditOk: boolean): void {
  inc(`ready.${status}`);
  emit({ ts: new Date().toISOString(), level: dbOk ? "info" : "warn", event: "ready.check", ms, status, dbOk, auditOk });
}

export function logVerifyLatency(ms: number, ok: boolean, partial: boolean, checkedEvents: number, totalEvents: number, firstBadSeq: number | null): void {
  inc(ok ? "verify.ok" : "verify.broken");
  if (partial) inc("verify.partial");
  emit({ ts: new Date().toISOString(), level: ok ? "info" : "warn", event: "audit.verify.latency", ms, ok, partial, checkedEvents, totalEvents, firstBadSeq });
}
