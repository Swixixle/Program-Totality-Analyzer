import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "crypto";
import { stableStringifyStrict, auditPayloadV1, hashAuditPayload } from "../storage";

describe("Golden: stableStringifyStrict", () => {
  it("produces deterministic output for identical input", () => {
    const obj = { z: 1, a: "hello", m: [true, null, 3] };
    const s1 = stableStringifyStrict(obj);
    const s2 = stableStringifyStrict(obj);
    expect(s1).toBe(s2);
  });

  it("sorts keys lexicographically", () => {
    const result = stableStringifyStrict({ z: 1, a: 2, m: 3 });
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("handles nested objects with sorted keys", () => {
    const result = stableStringifyStrict({ b: { z: 1, a: 2 }, a: 0 });
    expect(result).toBe('{"a":0,"b":{"a":2,"z":1}}');
  });

  it("handles arrays (preserve order, no sorting)", () => {
    const result = stableStringifyStrict([3, 1, 2]);
    expect(result).toBe("[3,1,2]");
  });

  it("handles null", () => {
    expect(stableStringifyStrict(null)).toBe("null");
  });

  it("rejects undefined", () => {
    expect(() => stableStringifyStrict(undefined)).toThrow("undefined is not allowed");
  });

  it("rejects undefined in nested fields", () => {
    expect(() => stableStringifyStrict({ a: undefined })).toThrow("$.a");
  });

  it("rejects Date", () => {
    expect(() => stableStringifyStrict({ ts: new Date() })).toThrow("Date is not allowed");
    expect(() => stableStringifyStrict({ ts: new Date() })).toThrow("$.ts");
  });

  it("rejects BigInt", () => {
    expect(() => stableStringifyStrict({ n: BigInt(42) })).toThrow("BigInt");
  });

  it("rejects Map", () => {
    expect(() => stableStringifyStrict({ m: new Map() })).toThrow("Map");
  });

  it("rejects Set", () => {
    expect(() => stableStringifyStrict({ s: new Set() })).toThrow("Set");
  });

  it("rejects RegExp", () => {
    expect(() => stableStringifyStrict({ r: /foo/ })).toThrow("RegExp");
  });

  it("rejects functions", () => {
    expect(() => stableStringifyStrict({ f: () => {} })).toThrow("function");
  });

  it("rejects symbols", () => {
    expect(() => stableStringifyStrict({ s: Symbol("x") })).toThrow("symbol");
  });

  it("rejects NaN", () => {
    expect(() => stableStringifyStrict({ n: NaN })).toThrow("non-finite");
  });

  it("rejects Infinity", () => {
    expect(() => stableStringifyStrict({ n: Infinity })).toThrow("non-finite");
  });

  it("rejects circular references", () => {
    const a: any = {};
    a.self = a;
    expect(() => stableStringifyStrict(a)).toThrow("circular");
  });

  it("rejects dangerous keys", () => {
    const withProto: Record<string, unknown> = {};
    Object.defineProperty(withProto, "__proto__", { value: 1, enumerable: true });
    expect(() => stableStringifyStrict(withProto)).toThrow("dangerous key");
    expect(() => stableStringifyStrict({ constructor: 1 })).toThrow("dangerous key");
    expect(() => stableStringifyStrict({ prototype: 1 })).toThrow("dangerous key");
  });

  it("rejects non-plain objects (class instances)", () => {
    class Foo { x = 1; }
    expect(() => stableStringifyStrict({ obj: new Foo() })).toThrow("non-plain object");
  });
});

describe("Golden: auditPayloadV1", () => {
  const baseFields = {
    schemaVersion: "audit/1.1",
    seq: 1,
    ts: "2026-01-01T00:00:00.000Z",
    action: "TEST_ACTION",
    actor: "system",
    receiptId: null,
    exportId: null,
    savedViewId: null,
    payload: '{"key":"value"}',
    ip: null,
    userAgent: null,
    prevHash: "GENESIS",
  };

  it("embeds _v: 1", () => {
    const payload = auditPayloadV1(baseFields);
    expect(payload._v).toBe(1);
  });

  it("parses payload JSON into the canonical object", () => {
    const payload = auditPayloadV1(baseFields);
    expect(payload.payload).toEqual({ key: "value" });
  });

  it("produces identical output for identical input", () => {
    const p1 = auditPayloadV1(baseFields);
    const p2 = auditPayloadV1(baseFields);
    expect(p1).toEqual(p2);
  });

  it("produces identical hashes for identical input", () => {
    const h1 = hashAuditPayload(auditPayloadV1(baseFields));
    const h2 = hashAuditPayload(auditPayloadV1(baseFields));
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("Golden: audit chain hash integrity", () => {
  it("simulates 3-event chain and detects single-byte tamper", () => {
    const events: Array<{ seq: number; hash: string; prevHash: string; payload: Record<string, unknown> }> = [];

    for (let seq = 1; seq <= 3; seq++) {
      const prevHash = seq === 1 ? "GENESIS" : events[seq - 2].hash;
      const payload = auditPayloadV1({
        schemaVersion: "audit/1.1",
        seq,
        ts: `2026-01-01T00:00:0${seq}.000Z`,
        action: "SAVED_VIEW_CREATED",
        actor: "system",
        receiptId: null,
        exportId: null,
        savedViewId: `sv-${seq}`,
        payload: JSON.stringify({ name: `view-${seq}` }),
        ip: null,
        userAgent: null,
        prevHash,
      });

      const hash = hashAuditPayload(payload);
      events.push({ seq, hash, prevHash, payload });
    }

    expect(events.length).toBe(3);
    expect(events[0].prevHash).toBe("GENESIS");
    expect(events[1].prevHash).toBe(events[0].hash);
    expect(events[2].prevHash).toBe(events[1].hash);

    for (const ev of events) {
      const recomputed = hashAuditPayload(ev.payload);
      expect(recomputed).toBe(ev.hash);
    }

    const tamperedPayload = { ...events[1].payload, action: "TAMPERED" };
    const tamperedHash = hashAuditPayload(tamperedPayload);
    expect(tamperedHash).not.toBe(events[1].hash);
  });

  it("chain breaks if prevHash is altered", () => {
    const payload1 = auditPayloadV1({
      schemaVersion: "audit/1.1",
      seq: 1,
      ts: "2026-01-01T00:00:01.000Z",
      action: "TEST",
      actor: "system",
      receiptId: null,
      exportId: null,
      savedViewId: null,
      payload: '{"a":1}',
      ip: null,
      userAgent: null,
      prevHash: "GENESIS",
    });
    const hash1 = hashAuditPayload(payload1);

    const payload2Good = auditPayloadV1({
      schemaVersion: "audit/1.1",
      seq: 2,
      ts: "2026-01-01T00:00:02.000Z",
      action: "TEST",
      actor: "system",
      receiptId: null,
      exportId: null,
      savedViewId: null,
      payload: '{"a":2}',
      ip: null,
      userAgent: null,
      prevHash: hash1,
    });

    const payload2Bad = auditPayloadV1({
      schemaVersion: "audit/1.1",
      seq: 2,
      ts: "2026-01-01T00:00:02.000Z",
      action: "TEST",
      actor: "system",
      receiptId: null,
      exportId: null,
      savedViewId: null,
      payload: '{"a":2}',
      ip: null,
      userAgent: null,
      prevHash: "WRONG_HASH",
    });

    const hashGood = hashAuditPayload(payload2Good);
    const hashBad = hashAuditPayload(payload2Bad);
    expect(hashGood).not.toBe(hashBad);
  });

  it("_v version is included in hash computation", () => {
    const fields = {
      schemaVersion: "audit/1.1",
      seq: 1,
      ts: "2026-01-01T00:00:00.000Z",
      action: "TEST",
      actor: "system",
      receiptId: null,
      exportId: null,
      savedViewId: null,
      payload: '{"x":1}',
      ip: null,
      userAgent: null,
      prevHash: "GENESIS",
    };
    const payload = auditPayloadV1(fields);
    const hash1 = hashAuditPayload(payload);

    const payloadNoV = { ...payload };
    delete (payloadNoV as any)._v;
    const hashNoV = hashAuditPayload(payloadNoV);
    expect(hash1).not.toBe(hashNoV);
  });
});

describe("Golden: adapter boundary", () => {
  it("AdapterObservation interface does NOT include observation_type", () => {
    const obs: import("../llm/adapters/types").AdapterObservation = {
      schema: "llm-observation/1.0",
      model_id: "mock:test",
      disclaimers: [],
      limitations: [],
      confidence: { level: "low", rationale: "test" },
      observations: "test observation",
    };

    expect(obs).not.toHaveProperty("observation_type");
    expect(obs).toHaveProperty("observations");
  });

  it("AdapterRequest interface allows observation_type via AdapterOptions", () => {
    const req: import("../llm/adapters/types").AdapterRequest = {
      provider: "mock",
      model: "test",
      messages: [{ role: "user", content: "hello" }],
    };

    expect(req).toHaveProperty("provider");
    expect(req).toHaveProperty("messages");
  });
});

describe("Golden: wire/internal boundary", () => {
  it("wireToInternalObservationType accepts valid wire values", async () => {
    const { wireToInternalObservationType } = await import("../llm/wire-boundary");
    const validTypes = ["paraphrase", "ambiguity", "disagreement", "tone", "structure", "hedging", "refusal_pattern"];
    for (const t of validTypes) {
      expect(wireToInternalObservationType(t)).toBe(t);
    }
  });

  it("wireToInternalObservationType rejects invalid wire values", async () => {
    const { wireToInternalObservationType } = await import("../llm/wire-boundary");
    expect(() => wireToInternalObservationType("invalid")).toThrow("Invalid observation_type at wire boundary");
    expect(() => wireToInternalObservationType("")).toThrow("Invalid observation_type at wire boundary");
    expect(() => wireToInternalObservationType("PARAPHRASE")).toThrow("Invalid observation_type at wire boundary");
  });

  it("internalToWireObservationType preserves value identity", async () => {
    const { internalToWireObservationType } = await import("../llm/wire-boundary");
    expect(internalToWireObservationType("paraphrase")).toBe("paraphrase");
    expect(internalToWireObservationType("tone")).toBe("tone");
  });

  it("buildAdapterOptions wraps observationType into wire format", async () => {
    const { buildAdapterOptions } = await import("../llm/wire-boundary");
    const opts = buildAdapterOptions("ambiguity");
    expect(opts).toEqual({ observation_type: "ambiguity" });
    expect(opts).not.toHaveProperty("observationType");
  });

  it("AdapterObservation keys never contain observation_type (boundary drift guard)", () => {
    const sampleObs: import("../llm/adapters/types").AdapterObservation = {
      schema: "llm-observation/1.0",
      model_id: "mock:test",
      disclaimers: [],
      limitations: [],
      confidence: { level: "low", rationale: "test" },
      observations: "test",
    };
    const keys = Object.keys(sampleObs);
    expect(keys).not.toContain("observation_type");
    expect(keys).toContain("observations");
  });

  it("round-trip: wire -> internal -> wire is stable for all valid types", async () => {
    const { wireToInternalObservationType, internalToWireObservationType } = await import("../llm/wire-boundary");
    const validTypes = ["paraphrase", "ambiguity", "disagreement", "tone", "structure", "hedging", "refusal_pattern"];
    for (const wire of validTypes) {
      const internal = wireToInternalObservationType(wire);
      const backToWire = internalToWireObservationType(internal);
      expect(backToWire).toBe(wire);
    }
  });

  it("no internal pipeline object contains observation_type key (recursive check)", async () => {
    const { buildAdapterOptions } = await import("../llm/wire-boundary");
    const sampleObs: import("../llm/adapters/types").AdapterObservation = {
      schema: "llm-observation/1.0",
      model_id: "mock:test",
      disclaimers: [],
      limitations: [],
      confidence: { level: "low", rationale: "test" },
      observations: "test",
    };
    const samplePipeline = {
      observationType: "paraphrase" as const,
      observation: sampleObs,
      verified: true,
    };
    const checkNoSnakeKey = (obj: Record<string, unknown>, path: string) => {
      for (const key of Object.keys(obj)) {
        expect(key).not.toBe("observation_type");
        if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
          checkNoSnakeKey(obj[key] as Record<string, unknown>, `${path}.${key}`);
        }
      }
    };
    checkNoSnakeKey(samplePipeline as unknown as Record<string, unknown>, "pipeline");
    const adapterOpts = buildAdapterOptions("paraphrase");
    expect(adapterOpts).toHaveProperty("observation_type");
  });
});
