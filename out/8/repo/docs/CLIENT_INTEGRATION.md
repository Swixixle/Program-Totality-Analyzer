# Client Integration: Proxy Pattern (Do Not Expose API Keys)

AI Receipts uses an authenticated verifier endpoint for receipt submission:

- **Privileged:** `POST /api/verify` (requires `x-api-key`)
- **Public, read-only (no auth required):**
  - `GET /api/public/receipts/:id/verify`
  - `GET /api/public/receipts/:id/proof`

---

## Core Rule

**Client applications must never call `POST /api/verify` directly from a browser.**

Browser environments cannot keep secrets. If you ship an API key to the frontend, you should assume it is compromised.

### Correct Architecture

```
Browser → Client Backend (proxy) → AI Receipts verifier
```

The client backend:
- stores the verifier API key in server secrets
- injects the key via the `x-api-key` header
- forwards the receipt capsule JSON to the verifier

### Incorrect Architecture

```
Browser → AI Receipts POST /api/verify
```

This leaks the key to:
- end users
- browser extensions
- logs / crash reports
- proxy tooling
- "View Source" + devtools

---

## When to Use Public Endpoints

The public endpoints are read-only verification and proof retrieval by receipt id:

- `GET /api/public/receipts/:id/verify`
- `GET /api/public/receipts/:id/proof`

Use these when:
- a receipt already exists
- you want to display verification status or fetch proof material
- you are building auditor / reader workflows

**Do not use public endpoints as a submission path.**
Submission is privileged by design.

---

## Proxy Pattern: Reference Implementations

### Express (Node) Proxy

Create a server endpoint in your client app (example: `/api/receipts/verify`) that forwards to AI Receipts.

**Environment variables (server-side only):**
- `AI_RECEIPTS_API_URL` (example: `https://receipts.example.com`)
- `AI_RECEIPTS_API_KEY` (your secret key)

```javascript
import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/receipts/verify", async (req, res) => {
  const apiUrl = process.env.AI_RECEIPTS_API_URL;
  const apiKey = process.env.AI_RECEIPTS_API_KEY;

  if (!apiUrl || !apiKey) {
    return res.status(500).json({
      error: "server_misconfigured",
      message: "Missing AI_RECEIPTS_API_URL or AI_RECEIPTS_API_KEY"
    });
  }

  const upstream = await fetch(`${apiUrl}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(req.body)
  });

  const contentType = upstream.headers.get("content-type") || "application/json";
  const text = await upstream.text();

  res.status(upstream.status).type(contentType).send(text);
});

app.listen(3000);
```

**Frontend code calls the proxy:**

```javascript
await fetch("/api/receipts/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(receiptCapsule)
});
```

---

### Next.js (App Router) Proxy

Create a server route: `app/api/receipts/verify/route.ts`

```typescript
export async function POST(req: Request) {
  const apiUrl = process.env.AI_RECEIPTS_API_URL;
  const apiKey = process.env.AI_RECEIPTS_API_KEY;

  if (!apiUrl || !apiKey) {
    return new Response(
      JSON.stringify({ error: "server_misconfigured", message: "Missing AI_RECEIPTS_API_URL or AI_RECEIPTS_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();

  const upstream = await fetch(`${apiUrl}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" }
  });
}
```

Frontend calls `/api/receipts/verify`.

---

## Security Requirements (Non-Negotiable)

### Do

- Store verifier keys only in server-side secrets / environment variables.
- Use a verify-only key where possible (least privilege).
- Rate-limit your proxy endpoint.
- Enforce payload size limits (receipt capsules should be small).
- Log only request IDs / status codes; do not log raw capsule content by default.

### Do Not

- Do not embed `x-api-key` in browser JS.
- Do not place the API key inside the receipt capsule JSON.
- Do not forward raw transcripts if your design claims "no transcript export."
- Do not treat verifier output as "truth." It is integrity/authenticity checking only.

---

## Operational Guidance

### Key Scope

If you support multiple keys, prefer:
- **VERIFY_ONLY** keys for client integrations
- **ADMIN** keys for internal tooling (saving, publishing, governance actions)

### Rate Limiting

Proxy endpoints should be rate limited by:
- IP
- session/user identity
- and/or receipt size

The verifier should be treated as an expensive, security-sensitive operation.

---

## Minimal Server-to-Server Test

From your client backend environment:

```bash
curl -X POST "$AI_RECEIPTS_API_URL/api/verify" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $AI_RECEIPTS_API_KEY" \
  -d @receipt_capsule.json
```

If authentication is correct, the verifier returns a structured JSON response (verification status + proof material as applicable).

---

## Integration Checklist

Before shipping your client integration, verify:

1. [ ] API key is stored in server-side environment variables only
2. [ ] Frontend code calls your proxy endpoint, not the verifier directly
3. [ ] Proxy endpoint enforces rate limiting
4. [ ] Proxy endpoint enforces payload size limits (< 1MB)
5. [ ] No API key appears in browser devtools Network tab
6. [ ] No API key appears in client-side bundle (search for key value)
7. [ ] Error responses do not leak upstream authentication details
8. [ ] Logs do not contain raw transcript content
9. [ ] Public endpoints used only for read-only verification display
10. [ ] Team understands: verification proves integrity, not truth
