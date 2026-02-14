# Lantern Audit Report (Ground Truth)

**Date**: January 21, 2026
**Status**: PROCEED (Baseline Functionality Restored)

## 1. Repository Map & Entrypoints

### File Structure
```
.
├── client
│   ├── index.html          # Web Entrypoint
│   └── src
│       ├── main.tsx        # React Root
│       ├── App.tsx         # Routing
│       ├── pages
│       │   └── lantern-extract.tsx # Main Application Logic
│       └── lib
│           └── lanternExtract.ts   # Core Extraction Engine (Client-Side)
├── server
│   ├── index.ts            # Express Server Entrypoint
│   ├── routes.ts           # API Routes (Currently Empty)
│   └── storage.ts          # Backend Storage Adapter (MemStorage - Unused)
├── shared
│   └── schema.ts           # Database Schema (Users - Unused)
└── package.json
```

### Entrypoints
*   **Client (Dev)**: `vite dev --port 5000` (via `npm run dev:client`)
*   **Server (Prod)**: `node dist/index.cjs` (via `npm start`)
*   **Full Stack (Dev)**: `tsx server/index.ts` (via `npm run dev`)

## 2. Runtime Architecture (As Built)

**Verdict**: **Hybrid (Client-Heavy)**.
While the repository contains a full-stack scaffold (`server/`, `drizzle`), the **active** application logic is **100% Client-Side**.

*   **Data Flow**: User Input (UI) → `extract()` (Browser JS) → `localStorage` (Browser).
*   **Server Role**: Currently acts only as a static asset host and API placeholder. `routes.ts` contains no active endpoints.
*   **Storage**:
    *   **Backend**: `MemStorage` (In-Memory Map) is implemented but **not connected** to the frontend.
    *   **Frontend**: `localStorage` is the *actual* system of record for Lantern Packs.

## 3. Network, Secrets & Telemetry

*   **Network Calls**: Zero application-level network calls found. No `fetch`, `axios`, or `XMLHttpRequest` calls inside `client/src` related to data transmission.
*   **Secrets**: No secrets are loaded or accessed. The app operates as an isolated tool.
*   **Telemetry**: No analytics or tracking scripts identified.

## 4. Storage & Persistence Reality

*   **Declared Schema**: `shared/schema.ts` defines a Postgres `users` table (Drizzle ORM).
*   **Actual Usage**:
    *   The server uses `MemStorage` (ephemeral RAM) for the `users` interface.
    *   The extraction app uses **Browser LocalStorage** (`key: lantern_packs`) for persisting extraction results.
    *   **Risk**: Data is lost if browser cache is cleared.

## 5. Extraction Engine Audit

**Module**: `client/src/lib/lanternExtract.ts`

*   **Methodology**: Deterministic Regex Heuristics (v0.1.5).
*   **Determinism**: Uses a custom `mockHash` function to generate stable IDs based on content + offsets.
*   **Segmentation**: Regex-based sentence approximation.
*   **Quality**: Implements a strict "Quality Contract" with F1 scoring against golden fixtures (`client/src/fixtures/`).

## 6. Known Failure Modes / Risks

1.  **Data Loss**: `localStorage` is volatile. Users *will* lose work if cache is cleared.
2.  **Performance**: Large texts (>1MB) processed synchronously in the main thread will freeze the UI.
3.  **Heuristic Fragility**: Regex extraction is brittle for complex nested entities or non-standard quote formats.
4.  **Backend Disconnect**: The server exists but does nothing; upgrading to real persistence requires wiring up the `server/routes.ts`.

## 7. Purchase-Grade Verdict

**PROCEED**.
The core engine integrity is high (good rigorous code), even if the storage layer is currently prototyping-grade (`localStorage`). The architecture is clean and ready for Phase 3 upgrades (Backend Persistence).

---

## Current Breakage & Root Cause (Fixed)

*   **Issue**: Application failed to load ("Does not work at all").
*   **Root Cause**:
    1.  **Syntax Error**: Missing closing `</div>` tag in `client/src/pages/lantern-extract.tsx` (Line ~866) caused React parser failure.
    2.  **Missing Logic**: Core `lanternExtract.ts` file was previously overwritten with placeholders, breaking the extraction function.
*   **Fix**:
    1.  Restored valid JSX structure.
    2.  Restored full heuristic extraction engine logic.
    3.  Verified via "Quality Dashboard" regression tests.
