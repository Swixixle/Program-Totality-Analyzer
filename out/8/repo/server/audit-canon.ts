import { createHash } from "crypto";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  if (x === null || typeof x !== "object") return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
}

function fail(path: string, msg: string): never {
  throw new Error(`stableStringifyStrict: ${msg} at ${path}`);
}

export function stableStringifyStrict(value: unknown): string {
  const seen = new WeakSet<object>();

  const walk = (v: unknown, path: string): string => {
    if (v === null) return "null";

    const t = typeof v;

    if (t === "string" || t === "boolean") return JSON.stringify(v);

    if (t === "number") {
      if (!Number.isFinite(v)) fail(path, "non-finite number (NaN/Infinity)");
      return JSON.stringify(v);
    }

    if (t === "undefined") fail(path, "undefined is not allowed (coerce to null before hashing)");
    if (t === "bigint") fail(path, "BigInt is not allowed");
    if (t === "function") fail(path, "function is not allowed");
    if (t === "symbol") fail(path, "symbol is not allowed");

    if (t === "object") {
      if (v instanceof Date) fail(path, "Date is not allowed — use ISO string or epoch");
      if (v instanceof Map) fail(path, "Map is not allowed");
      if (v instanceof Set) fail(path, "Set is not allowed");
      if (v instanceof RegExp) fail(path, "RegExp is not allowed");
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) fail(path, "Buffer is not allowed");

      if (Array.isArray(v)) {
        if (seen.has(v)) fail(path, "circular reference");
        seen.add(v);
        return "[" + v.map((item, i) => walk(item, `${path}[${i}]`)).join(",") + "]";
      }

      if (!isPlainObject(v)) fail(path, "non-plain object (class/instance) is not allowed");

      if (seen.has(v)) fail(path, "circular reference");
      seen.add(v);

      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      for (const k of keys) {
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          fail(`${path}.${k}`, "dangerous key is not allowed");
        }
      }
      return "{" + keys.map(k => JSON.stringify(k) + ":" + walk(obj[k], `${path}.${k}`)).join(",") + "}";
    }

    fail(path, `unsupported type: ${t}`);
  };

  return walk(value, "$");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashAuditPayload(payload: unknown): string {
  return sha256Hex(stableStringifyStrict(payload));
}

export interface AuditEventFields {
  schemaVersion: string;
  seq: number;
  ts: string;
  action: string;
  actor: string;
  receiptId: string | null;
  exportId: string | null;
  savedViewId: string | null;
  payload: string;
  ip: string | null;
  userAgent: string | null;
  prevHash: string;
}

export function auditPayloadV1(fields: AuditEventFields): Record<string, unknown> {
  return {
    _v: 1,
    schemaVersion: fields.schemaVersion,
    seq: fields.seq,
    ts: fields.ts,
    action: fields.action,
    actor: fields.actor,
    receiptId: fields.receiptId,
    exportId: fields.exportId,
    savedViewId: fields.savedViewId,
    payload: JSON.parse(fields.payload),
    ip: fields.ip,
    userAgent: fields.userAgent,
    prevHash: fields.prevHash,
  };
}
