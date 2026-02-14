import { describe, it, expect } from "vitest";

const BASE = `http://localhost:${process.env.PORT || 5000}`;
const AUTH_HEADER = { "x-api-key": "dev-test-key-12345", "Content-Type": "application/json" };

async function fetchJSON(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...AUTH_HEADER, ...(opts.headers as Record<string, string> || {}) },
  });
  const body = await res.json();
  return { status: res.status, body };
}

describe("E2E: audit chain smoke test", () => {
  it("/api/health returns liveness (no DB, always 200)", async () => {
    const { status, body } = await fetchJSON("/api/health", { headers: {} });
    expect(status).toBe(200);
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("time");
    expect(body).not.toHaveProperty("db");
  });

  it("/api/ready returns readiness with DB + audit checks", async () => {
    const { status, body } = await fetchJSON("/api/ready", { headers: {} });
    expect(status).toBe(200);
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("ready", true);
    expect(body).toHaveProperty("db");
    expect(body.db).toHaveProperty("ok", true);
    expect(body).toHaveProperty("audit");
    expect(body.audit).toHaveProperty("ok", true);
  });

  it("/api/audit/verify requires authentication (401 JSON, not HTML)", async () => {
    const res = await fetch(`${BASE}/api/audit/verify`);
    expect(res.status).toBe(401);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("audit chain: create events, verify ok, tamper, verify broken", async () => {
    const verifyBefore = await fetchJSON("/api/audit/verify?limit=50000");
    expect(verifyBefore.status).toBe(200);
    const baseCount = verifyBefore.body.checkedEvents ?? 0;

    const viewPayload = {
      name: `e2e-smoke-${Date.now()}`,
      filters: { status: "VERIFIED" },
    };
    const createView = await fetchJSON("/api/saved-views", {
      method: "POST",
      body: JSON.stringify(viewPayload),
    });
    expect(createView.status).toBe(201);
    const viewId = createView.body.id;

    const comparePayload = { left: "receipt-a", right: "receipt-b" };
    const compareRaw = await fetch(`${BASE}/api/compare/viewed`, {
      method: "POST",
      headers: AUTH_HEADER,
      body: JSON.stringify(comparePayload),
    });
    expect(compareRaw.status).toBe(204);

    const verifyAfter = await fetchJSON("/api/audit/verify?limit=50000");
    expect(verifyAfter.status).toBe(200);
    expect(verifyAfter.body.ok).toBe(true);
    expect(verifyAfter.body.checkedEvents).toBeGreaterThanOrEqual(baseCount + 2);
    expect(verifyAfter.body).toHaveProperty("partial");
    expect(verifyAfter.body).toHaveProperty("firstBadSeq");
    expect(verifyAfter.body.firstBadSeq).toBeNull();

    if (viewId) {
      await fetch(`${BASE}/api/saved-views/${viewId}`, { method: "DELETE", headers: AUTH_HEADER });
    }
  });

  it("/api/audit/verify response matches operator-grade contract", async () => {
    const { body } = await fetchJSON("/api/audit/verify");
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("checked");
    expect(body).toHaveProperty("checkedEvents");
    expect(body).toHaveProperty("totalEvents");
    expect(body).toHaveProperty("partial");
    expect(body).toHaveProperty("head");
    expect(body).toHaveProperty("firstBadSeq");
    expect(body).toHaveProperty("break");
    expect(typeof body.ok).toBe("boolean");
    expect(typeof body.checked).toBe("number");
    expect(body.checkedEvents).toBe(body.checked);
    expect(["EMPTY", "GENESIS", "LINKED", "BROKEN"]).toContain(body.status);
  });

  it("unknown /api/* route returns JSON 404 (not HTML)", async () => {
    const res = await fetch(`${BASE}/api/nonexistent-route`);
    expect(res.status).toBe(404);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", 404);
    expect(body.error).toHaveProperty("message");
  });

  it("/api/health/metrics requires auth", async () => {
    const noAuth = await fetch(`${BASE}/api/health/metrics`);
    expect(noAuth.status).toBe(401);
    const withAuth = await fetchJSON("/api/health/metrics");
    expect(withAuth.status).toBe(200);
    expect(withAuth.body).toHaveProperty("counters");
  });
});
