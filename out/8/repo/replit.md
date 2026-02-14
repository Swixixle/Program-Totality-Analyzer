# AI Receipts - Forensic Verification System

## Overview
AI Receipts is a forensic verification system designed to provide cryptographic verification, immutable storage, and forensic analysis for AI conversation transcripts. Its core purpose is to ensure the integrity and authenticity of AI interactions, enabling detailed forensic examination and preventing tampering. The project aims to establish a trusted framework for AI accountability and transparency.

## User Preferences
Not specified.

## System Architecture

### Core Capabilities
- **Receipt Verification**: Validates AI conversation receipts using SHA-256 hash verification and Ed25519 signatures.
- **Canonicalization (c14n-v1)**: Employs deterministic JSON canonicalization for consistent hashing across all receipts.
- **Immutable Storage**: Verified receipts are permanently locked against modification.
- **Kill Switch**: Provides an irreversible mechanism to disable interpretation for any given receipt.
- **Interpretation System**: Supports append-only interpretations categorized as FACT, INTERPRETATION, or UNCERTAINTY.
- **Tri-Sensor Analysis**: Facilitates parallel analysis of transcripts using an interpreter, summarizer, and claim extractor.
- **Receipt Chaining**: Verifies cryptographic links between sequential receipts using SHA256 hashes of canonicalized core fields.
- **Forensic Detectors**: Independently analyze transcripts for risk keywords, high-entropy patterns, and PII heuristics, generating integrity context based on verification status.
- **LLM Sensor Integration**: Allows LLMs to observe and describe transcript content (paraphrase, ambiguity, tone, etc.) without making truth judgments, ensuring data isolation from verification outcomes.
- **Research Dataset**: Generates anonymized, aggregatable research data for model behavior analysis with explicit opt-in consent and strict exclusion of sensitive information.
- **Tamper-Evident Share Pack**: Provides a hash-chained forensic event log and a system for building verifiable share packs with sensitive data redaction.
- **Bulk Export System**: Allows authenticated users to export receipts in various formats (JSONL, CSV) with guardrails for PII and kill-switched content.
- **Saved Views**: Enables users to store and manage filtered receipt views.
- **Receipt Comparison**: Side-by-side comparison of two receipts with field deltas, forensics comparison, and per-side actions (View Detail, Proof Pack, Export).
- **Proof Spine v1**: Canonical `/api/proofpack/:receiptId` endpoint returns unified proof pack with integrity, signature, chain status, and audit summary. All downstream modules consume this single contract.
- **Proof-Gated Lantern**: `POST /api/lantern/followup` only responds when receipt is VERIFIED. Stores durable threads with ProofPack snapshot. Thread CRUD: `GET /api/lantern/threads/:receiptId`, `GET /api/lantern/thread/:threadId/messages`.
- **Durable Threads**: `threads` and `thread_messages` tables for conversation continuity with receipt binding and ProofPack snapshot at creation time.
- **Append-Only Audit Trail**: Logs all operator actions (saved view create/delete/apply, bulk export lifecycle, receipt export, comparison views, lantern followup) with IP, user-agent, and JSON payload. Displayed on Governance page with action filter, receipt ID filter, pagination, and copy-payload button.
- **Backend Pagination**: Implements server-side pagination, filtering, and sorting for efficient data retrieval.
- **Health Endpoints**: `GET /api/health` (liveness, no DB), `GET /api/ready` (readiness, DB + audit head, anti-flap), `GET /api/health/metrics` (in-memory counters).
- **Cursor-Based Audit Verify**: `GET /api/audit/verify` supports `fromSeq`/`toSeq` for targeted segment verification, rate-limited via `rateLimitVerify`.
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy on all responses.
- **Wire/Internal Boundary**: Formalized `wireToInternalObservationType()` / `internalToWireObservationType()` in `server/llm/wire-boundary.ts`.
- **Instrumentation**: Structured JSON logging + in-memory counters for audit, policy, adapter, and rate-limit events.
- **Ed25519 Signed Checkpoints**: Automatic checkpoint creation every N events (configurable via `CHECKPOINT_INTERVAL`), stored in `audit_checkpoints` table with signature verification. Signed payload includes `engine_id`, `audit_payload_version`, `checkpoint_seq`, `event_seq`, `event_hash` for ungameable binding.
- **Checkpoint Chain Continuity**: Each checkpoint links to its predecessor via `prev_checkpoint_id` and `prev_checkpoint_hash`, verified by offline verifier.
- **Version Stamping**: Centralized `server/version.ts` embeds semver + git commit in forensic packs and API responses.
- **CI**: GitHub Actions workflow (`.github/workflows/ci.yml`) runs typecheck, test, canon drift guard, boundary drift guard, proof run, build on PR + main. Proof bundle uploaded as artifact with 90-day retention.
- **Proof Run**: `scripts/proof_run.ts` orchestrates end-to-end proof generation: tests → event generation → checkpoint forcing → forensic pack export → clean verification → tamper detection → artifact output.
- **Verifier Release**: `scripts/build_verifier_release.ts` packages standalone offline verifier into self-contained zip (compiled JS + public key + README, no external dependencies).
- **Release Workflow**: `.github/workflows/release.yml` triggers on `v*` tags, runs full CI, builds proof bundle + verifier zip, computes SHA-256 checksums, publishes GitHub Release.
- **Key Ring Support**: Verifier accepts `--key-ring <dir>` for multi-key verification; each checkpoint's `publicKeyId` matched to `<kid>.pem` file. Enables seamless key rotation.
- **Key Custody Model**: Dev/staging/prod key environments with `CHECKPOINT_KEY_ENV` classification. Key ring rotation protocol documented in THREAT_MODEL.md.
- **External Anchoring**: `server/checkpoint-anchor.ts` defines `CheckpointAnchor` interface with `anchor()`, `verify()`, `name()` methods. Four backends: LogOnly (default), S3WormAnchor (real S3 Object Lock with GOVERNANCE/COMPLIANCE modes), Rfc3161TsaAnchor (RFC3161 timestamp authority with messageImprint validation and trusted fingerprints), MultiAnchor (fan-out to multiple backends). Configured via `CHECKPOINT_ANCHOR_TYPE` env var. S3 supports cross-account IAM, configurable retention days, objectBody/objectHash for offline verification. RFC3161 supports pinned TSA cert allowlist.
- **Anchor Modes**: `--anchors=required` in proof_run hard-fails when only log-only backend configured. `--anchors=optional` (default) allows log-only for dev/testing.
- **Anchor Payload v1**: Constant-size canonical JSON payload with `_v`, `engine_id`, `audit_payload_version`, `checkpoint_id`, `checkpoint_seq`, `event_seq`, `event_hash`, `checkpoint_hash`, `kid`, `created_at`. SHA-256 hash of payload stored as `anchorHash`.
- **Anchor Receipts in Forensic Packs**: Format 1.2 includes `anchorReceipts` array. Offline verifier validates anchor hash integrity, checkpoint binding, and reports anchor type coverage.
- **Proof Bundle Spec**: `docs/PROOF_BUNDLE.md` documents bundle files, what each proves, expected outputs, and failure meanings.
- **Regulatory Alignment**: `docs/REGULATORY_ALIGNMENT.md` maps capabilities to 21 CFR Part 11, HIPAA, SOC 2, ISO 27001, EU AI Act, NIST AI RMF.
- **Regulatory Matrix Excerpt**: `docs/REGULATORY_MATRIX_EXCERPT.md` provides 10-row compliance officer quick reference across 6 frameworks.
- **Executive Summary**: `docs/EXECUTIVE_SUMMARY.md` 2-page non-technical overview for pilots.
- **Crypto Agility**: `docs/CRYPTO_AGILITY.md` documents signature abstraction and PQC migration roadmap (Ed25519 → ML-DSA).
- **Documentation Index**: `docs/START_HERE.md` provides 90-second overview, pilot packet links, reading order, and release process description.
- **Non-Goals Document**: `docs/NON_GOALS.md` defines explicit boundaries: no truth judgments, no content moderation, no real-time monitoring, single-operator model.
- **Competitive Comparison**: `docs/COMPETITIVE_COMPARISON.md` positions system vs. AI observability, immutable databases, and governance platforms.
- **Release Reproducibility**: CI rebuilds verifier zip and compares SHA-256 hashes for deterministic builds.
- **Sigstore Cosign Signing**: All release artifacts signed with keyless OIDC; `.sig` and `.pem` files published.
- **SBOM**: CycloneDX 1.5 format documenting zero external dependencies.
- **Key Rotation Proof Tests**: 8 tests covering dual-key eras, chain continuity across rotation, missing/wrong key detection.
- **Anchor Integration Tests**: 22 tests covering anchor_hash integrity, tamper detection, S3 objectBody/objectHash validation, RFC3161 messageImprint validation, MultiAnchor fan-out, anchor-required mode, payload binding.
- **Failure-Mode Playbooks**: Key compromise, key loss, incorrect rotation, unknown kid resolution procedures in THREAT_MODEL.md.
- **External Anchoring Guide**: `docs/EXTERNAL_ANCHORING.md` documents what anchoring prevents/doesn't, threat model delta (2-party → 4-party collusion), minimal IAM policy, deployment recommendations.
- **Pilot Setup Guide**: `docs/PILOT_SETUP_AWS_ANCHOR_ACCOUNT.md` step-by-step AWS S3 Object Lock anchor account setup with IAM policy, retention config, cross-account setup, and verification checklist.
- **TSA Providers Guide**: `docs/TSA_PROVIDERS.md` tested TSA provider configs (FreeTSA, DigiCert, Sectigo), fingerprint pinning instructions, environment recommendations.
- **Objections Document**: `docs/OBJECTIONS_AND_PRECISE_ANSWERS.md` stakeholder Q&A one-pager covering truth claims, admin rewrite, key rotation, anchor downtime, offline verification, PII, verifier integrity, compliance, non-goals.
- **Pilot Runbook**: `docs/PILOT_RUNBOOK.md` end-to-end pilot flow from clone to verified proof with artifact inventory.
- **Anchor Smoke Test**: `scripts/anchor_smoke.ts` validates anchor backend (S3/TSA/log-only) write, verify, binding, and tamper detection.
- **TSA Smoke Test**: `scripts/tsa_smoke.ts` validates RFC3161 TSA messageImprint, payload binding, and tamper detection.
- **CI Split**: `.github/workflows/ci.yml` split into 4 jobs: test gate, determinism gate, proof bundle (log-only), proof bundle (anchored, conditional on ANCHORS_AVAILABLE var).

### UI/UX Decisions
- Frontend built with React, TypeScript, Tailwind CSS, and shadcn/ui.
- Row virtualization is used for efficient rendering of large datasets.
- UI components include debounced search, filter selectors, pagination controls, and confirmation dialogs for sensitive operations.
- Global audit integrity banner at top of all pages showing verified/partial/broken/degraded status.

### Technical Implementation
- **Backend**: Express.js with Node.js 20.
- **Database**: PostgreSQL with Drizzle ORM.
- **Validation**: Zod schemas for robust data validation.
- **Cryptography**: Node.js built-in crypto module for SHA-256 hashing and Ed25519 signing.
- **Rate Limiting**: Per-IP burst and sustained rate limits on API endpoints.
- **Authentication**: API key-based authentication for private endpoints.
- **Testing**: 72 tests total — 35 golden tests + 7 E2E integration tests + 8 key rotation proof tests + 22 anchor integration tests (run via `npx vitest run --config vitest.config.ts`).
- **Guards & Constraints**:
    - Unverified receipts cannot be interpreted.
    - Kill switch is irreversible and blocks all interpretations.
    - Interpretations are append-only.
    - Immutable lock prevents raw JSON modification.
    - Private endpoints require valid API keys.

## External Dependencies
- **PostgreSQL**: Relational database for storing receipt data, interpretations, and system configurations.
- **Drizzle ORM**: Object-Relational Mapper for interacting with PostgreSQL.
- **React**: JavaScript library for building user interfaces.
- **TypeScript**: Superset of JavaScript that adds static typing.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: Component library built on Tailwind CSS and Radix UI.
- **Express.js**: Web application framework for Node.js.
- **Zod**: TypeScript-first schema declaration and validation library.
- **Archiver**: Library for creating ZIP archives (used in bulk export).
- **@tanstack/react-virtual**: Library for efficient virtualization of large lists in React.