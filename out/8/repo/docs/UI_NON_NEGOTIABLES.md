# UI Non-Negotiables

> **Authority:** These rules are absolute. No exceptions. No "improvements."

---

## 1. Forbidden Words in UI Copy

The following words MUST NEVER appear in any UI text, labels, tooltips, or error messages:

```
true
false
correct
incorrect
accurate
inaccurate
truth
lie
lying
misleading
verified meaning
factual
proves
invalid (when referring to content, not crypto)
wrong
right (when referring to correctness)
hallucination
deceptive
therefore (implying logical conclusion about content)
```

**Exception:** "VERIFIED" refers ONLY to cryptographic verification status, never to content truth.

**Enforcement:** CI test scans all UI strings and fails if forbidden words appear.

---

## 2. Kill Switch Absolute Rules

When kill switch is ENGAGED:

- Sensors tab: HIDDEN
- Interpretations tab: HIDDEN  
- LLM-triggering UI controls: DISABLED
- No overrides permitted
- No conditional logic to bypass

**Required banner (verbatim):**
> "Kill switch engaged. Interpretations and sensor outputs are blocked."

Verification, Forensics, and Event Log panels REMAIN VISIBLE.

---

## 3. Transcript Rendering vs Persistence

### ALLOWED
- Render transcript content based on transcript mode (full/redacted/hidden)
- Pass transcript to components for display

### FORBIDDEN
- `localStorage` / `sessionStorage` for transcript data
- Caching transcripts in any form
- Logging transcript content
- Analytics that capture transcript text
- Session replay tools
- Rehydrating transcripts from any storage

**Enforcement:** CI grep/ESLint checks for localStorage, sessionStorage, known analytics SDKs.

---

## 4. No New Endpoints Rule

The UI consumes ONLY existing API endpoints:

- `POST /api/verify`
- `GET /api/receipts`
- `GET /api/receipts/:id`
- `POST /api/receipts/:id/kill`
- `POST /api/receipts/:id/interpret`
- `POST /api/receipts/:id/observe`
- `POST /api/receipts/:id/observe/multi`
- `GET /api/receipts/:id/observations`
- `GET /api/receipts/:id/export`
- `GET /api/public/receipts/:id/verify`
- `GET /api/config/transcript-mode`
- `GET /health`

If a UI feature requires data not available from these endpoints: **STOP and file a ticket.**
Do NOT infer, mock, or fabricate data.

---

## 5. Append-Only Interpretations

- No edit buttons
- No delete buttons
- No reorder controls
- No overwrite operations

Once submitted, interpretations are immutable in the UI.

---

## 6. Capability Representation

### Implemented Capabilities (display as-is)
- Hash verification
- Forensic detectors
- Forensic export
- Signature verification
- Chain verification
- Key governance
- Public verification
- Rate limiting
- API authentication
- Research export
- LLM sensor (observer-only)

### Forbidden Capabilities (display as-is)
- LLM judgment
- Truth scoring
- Truth arbitration
- Model reconciliation
- Behavioral interpretation

These lists are STATIC. Do not add, remove, or rename items.

---

## 7. Verbatim Microcopy

The following strings MUST appear exactly as written:

### Kill Switch Pill
> "Interpretation and sensor outputs are disabled when the kill switch is engaged."

### Verification Result Subtitle
> "This status reflects cryptographic and chain checks only."

### Transcript Mode Tooltip
> "Transcript mode controls rendering only. Raw transcripts are never persisted."

### Forensics Panel
> "Detectors are heuristic signals. They do not imply intent or meaning."

### Interpretations Tab
> "Interpretations are append-only. Prior entries are never edited."

### Sensors Isolation Notice
> "This output is isolated. The model received only transcript text."

### Multi-Model Disagreement Banner
> "Disagreement is displayed without resolution by design."

---

## Enforcement Summary

| Rule | Enforcement Method |
|------|-------------------|
| Forbidden words | CI test scans UI strings |
| No persistence | ESLint/grep for localStorage, sessionStorage, analytics |
| Kill switch absolute | Component tests + E2E tests |
| Verbatim microcopy | Snapshot tests |
| No new endpoints | Code review + API call audit |
