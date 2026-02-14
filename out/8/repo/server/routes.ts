import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { canonicalize, computeHash } from "./c14n";
import { computeForensics } from "./forensics";
import { verifySignature, type SignatureVerificationResult } from "./key-registry";
import { verifyChainLink, computeReceiptHash, buildCapsuleCore, type ChainVerificationResult } from "./chain-verification";
import { verifyRequestSchema, interpretRequestSchema, lanternFollowupSchema, type VerifyResult, type TriSensorResult, type ExportReport, type ForensicsResult, type ProofPack, type Receipt } from "@shared/schema";
import { randomUUID } from "crypto";
import { fromError } from "zod-validation-error";
import { verifyLimiter, publicVerifyLimiter, getClientIp } from "./rate-limiter";
import { 
  logAuthFailure, 
  logRateLimitExceeded, 
  logPayloadRejected, 
  logKillSwitch,
  detectPromptInjection,
  logPromptInjectionFlag,
  logForbiddenWords 
} from "./security-audit";
import { requireAuth } from "./auth";
import { buildResearchRecord, toDbFormat } from "./research-builder";
import { RESEARCH_SCHEMA_VERSION } from "@shared/research-schema";
import { 
  createPublicError, 
  createRateLimitHeaders,
  PUBLIC_ERROR_CODES,
  TRANSCRIPT_MODE_CONTRACT,
} from "@shared/public-contract";
import { bulkExportRequestSchema, createSavedViewSchema, updateSavedViewSchema } from "@shared/schema";
import { generateBulkExport, getExportFilePath, exportFileExists } from "./bulk-export";
import { llmObservationRequestSchema, multiModelObservationRequestSchema } from "@shared/llm-observation-schema";
import { logMilestone } from "./forensic-log";
import { logAuditVerifyResult, logAdapterError, getCounters, logReadyCheck, logVerifyLatency } from "./instrumentation";
import { getVersionInfo } from "./version";

const ENGINE_ID = getVersionInfo().engineId;

function apiError(res: Response, code: number, message: string, detail?: string): void {
  res.status(code).json({
    error: { code, message, ...(detail ? { detail } : {}) },
  });
}

async function logAudit(action: string, opts: {
  receiptId?: string;
  exportId?: string;
  savedViewId?: string;
  payload?: Record<string, unknown>;
  req?: import("express").Request;
} = {}): Promise<void> {
  try {
    await storage.appendAuditEvent({
      action,
      actor: "operator",
      receiptId: opts.receiptId ?? null,
      exportId: opts.exportId ?? null,
      savedViewId: opts.savedViewId ?? null,
      payload: JSON.stringify(opts.payload ?? {}),
      ip: opts.req ? getClientIp(opts.req) : null,
      userAgent: opts.req?.headers["user-agent"]?.slice(0, 256) ?? null,
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

// Helper to convert interpretation bucket back to representative count for export
function bucketToCount(bucket: string): number {
  switch (bucket) {
    case "0": return 0;
    case "1-2": return 1;
    case "3-5": return 4;
    case "6-10": return 8;
    case "10+": return 15;
    default: return 0;
  }
}

// P4: Request size limits
const MAX_REQUEST_SIZE_BYTES = 1024 * 1024; // 1MB max

// P4: Rate limiting middleware for public endpoints (P6.6 hardened)
function rateLimitPublic(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = publicVerifyLimiter.check(ip);
  
  // P6.6: Always add rate limit headers
  const rateLimitHeaders = createRateLimitHeaders(
    result.limit,
    result.remaining,
    result.resetMs,
    result.allowed ? undefined : result.retryAfterMs
  );
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (!result.allowed) {
    // P7.5: Log rate limit exceeded event
    logRateLimitExceeded(req.path, ip, result.reason?.includes("burst") ? "burst" : "sustained");
    
    const errorResponse = createPublicError(
      PUBLIC_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      result.reason || "Rate limit exceeded",
      { retry_after_seconds: Math.ceil(result.retryAfterMs / 1000) }
    );
    res.status(429).json(errorResponse);
    return;
  }
  
  next();
}

// P4: Rate limiting middleware for verify endpoint (P6.6 hardened)
function rateLimitVerify(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = verifyLimiter.check(ip);
  
  // P6.6: Always add rate limit headers
  const rateLimitHeaders = createRateLimitHeaders(
    result.limit,
    result.remaining,
    result.resetMs,
    result.allowed ? undefined : result.retryAfterMs
  );
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (!result.allowed) {
    // P7.5: Log rate limit exceeded event
    logRateLimitExceeded(req.path, ip, result.reason?.includes("burst") ? "burst" : "sustained");
    
    const errorResponse = createPublicError(
      PUBLIC_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      result.reason || "Rate limit exceeded",
      { retry_after_seconds: Math.ceil(result.retryAfterMs / 1000) }
    );
    res.status(429).json(errorResponse);
    return;
  }
  
  next();
}

// P4: Request size check middleware
// P6.6: Request size check with canonical error response
function checkRequestSize(req: Request, res: Response, next: NextFunction): void {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  
  if (contentLength > MAX_REQUEST_SIZE_BYTES) {
    // P7.5: Log payload rejected event
    logPayloadRejected(req.path, contentLength, MAX_REQUEST_SIZE_BYTES);
    
    const errorResponse = createPublicError(
      PUBLIC_ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Request body exceeds maximum size of ${MAX_REQUEST_SIZE_BYTES} bytes`,
      { max_size_bytes: MAX_REQUEST_SIZE_BYTES, received_bytes: contentLength }
    );
    res.status(413).json(errorResponse);
    return;
  }
  
  next();
}

// P7.2: Content-Type validation middleware
// Rejects non-JSON content types for API endpoints
function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
  // Skip for GET/HEAD/OPTIONS requests (no body)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  
  const contentType = req.headers["content-type"] || "";
  
  // Accept application/json or application/json; charset=utf-8
  if (!contentType.includes("application/json")) {
    const errorResponse = createPublicError(
      PUBLIC_ERROR_CODES.INVALID_REQUEST_BODY,
      "Content-Type must be application/json",
      { received_content_type: contentType || "none" }
    );
    res.status(400).json(errorResponse);
    return;
  }
  
  next();
}

// P7.2: UTF-8 validation - ensure request body is valid UTF-8
// Express json() parser handles this, but we add explicit check for malformed sequences
function validateUtf8Body(req: Request, res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body !== "object") {
    next();
    return;
  }
  
  try {
    // Stringify and parse to detect any encoding issues
    const testStr = JSON.stringify(req.body);
    // Check for replacement characters (indicates invalid UTF-8)
    if (testStr.includes("\uFFFD")) {
      const errorResponse = createPublicError(
        PUBLIC_ERROR_CODES.INVALID_REQUEST_BODY,
        "Request body contains invalid UTF-8 sequences"
      );
      res.status(400).json(errorResponse);
      return;
    }
  } catch {
    const errorResponse = createPublicError(
      PUBLIC_ERROR_CODES.INVALID_REQUEST_BODY,
      "Request body is not valid JSON"
    );
    res.status(400).json(errorResponse);
    return;
  }
  
  next();
}

// P7.2: Combined input hardening middleware chain
function inputHardening(req: Request, res: Response, next: NextFunction): void {
  // Apply checks in sequence
  checkRequestSize(req, res, (err?: any) => {
    if (err || res.headersSent) return;
    requireJsonContentType(req, res, (err2?: any) => {
      if (err2 || res.headersSent) return;
      validateUtf8Body(req, res, next);
    });
  });
}

// Transcript display mode: full | redacted | hidden
// Can be set via environment variable TRANSCRIPT_MODE
type TranscriptMode = "full" | "redacted" | "hidden";
const VALID_TRANSCRIPT_MODES: TranscriptMode[] = ["full", "redacted", "hidden"];
const rawMode = process.env.TRANSCRIPT_MODE || "full";
const TRANSCRIPT_MODE: TranscriptMode = VALID_TRANSCRIPT_MODES.includes(rawMode as TranscriptMode) 
  ? (rawMode as TranscriptMode) 
  : "full";

// PII redaction patterns for redacted mode
function redactPii(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL REDACTED]")
    .replace(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE REDACTED]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN REDACTED]")
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "[IP REDACTED]");
}

async function buildProofPack(receipt: Receipt): Promise<ProofPack> {
  let rawCapsule: any = {};
  try {
    rawCapsule = JSON.parse(receipt.rawJson);
  } catch {}

  let auditStatus: "LINKED" | "EMPTY" | "DEGRADED" = "DEGRADED";
  let headHash: string | null = null;
  let headSeq: number | null = null;
  let totalEvents = 0;

  try {
    const [head, eventCount] = await Promise.all([
      storage.getAuditHead(),
      storage.getAuditEventCount(),
    ]);
    totalEvents = eventCount;
    if (head) {
      headHash = head.lastHash;
      headSeq = head.lastSeq;
      auditStatus = head.lastHash !== "GENESIS" ? "LINKED" : "EMPTY";
    } else {
      auditStatus = eventCount === 0 ? "EMPTY" : "DEGRADED";
    }
  } catch {
    auditStatus = "DEGRADED";
  }

  return {
    schema: "ai-receipt/proof-pack/1.0",
    receipt_id: receipt.receiptId,
    platform: receipt.platform,
    captured_at: receipt.capturedAt,
    verified_at: receipt.verifiedAt,
    verification_status: receipt.verificationStatus as "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED",
    kill_switch_engaged: receipt.hindsightKillSwitch === 1,
    integrity: {
      hash_match: receipt.hashMatch === 1,
      computed_hash_sha256: receipt.computedHashSha256,
      expected_hash_sha256: receipt.expectedHashSha256,
      receipt_hash_sha256: receipt.receiptHashSha256 || "",
      canonicalization: "c14n-v1",
    },
    signature: {
      status: (receipt.signatureStatus || "NO_SIGNATURE") as "VALID" | "INVALID" | "UNTRUSTED_ISSUER" | "NO_SIGNATURE",
      algorithm: rawCapsule.signature?.alg || null,
      public_key_id: rawCapsule.signature?.public_key_id || null,
      issuer_id: receipt.signatureIssuerId || null,
      issuer_label: receipt.signatureIssuerLabel || null,
      key_governance: {
        key_status: (receipt.signatureKeyStatus as "ACTIVE" | "REVOKED" | "EXPIRED" | null) || null,
        valid_from: null,
        valid_to: null,
        revoked_reason: null,
      },
    },
    chain: {
      status: (receipt.chainStatus || "NOT_CHECKED") as "GENESIS" | "LINKED" | "BROKEN" | "NOT_CHECKED",
      previous_receipt_id: receipt.previousReceiptId || null,
      previous_receipt_hash: rawCapsule.previous_receipt_hash_sha256 || null,
      is_genesis: !receipt.previousReceiptId && receipt.chainStatus === "GENESIS",
      link_verified: receipt.chainStatus === "LINKED" || receipt.chainStatus === "GENESIS",
    },
    audit: {
      total_events: totalEvents,
      head_hash: headHash,
      head_seq: headSeq,
      status: auditStatus,
    },
    proof_scope: ["integrity", "signature", "chain"] as const,
    proof_scope_excludes: ["truth", "completeness", "authorship_intent"] as const,
    _contract: {
      proof_pack_version: "1.0",
      transcript_included: false,
      observations_included: false,
      research_data_included: false,
      integrity_proofs_only: true,
    },
  };
}

const DEMO_RECEIPT_ID = "halo-demo-receipt-001";

const DEMO_CAPSULE = {
  schema: "ai-receipt/1.0" as const,
  receipt_id: DEMO_RECEIPT_ID,
  platform: "halo-demo",
  captured_at: "2025-12-01T10:30:00Z",
  capture_agent: "halo-receipts/demo-seed",
  transcript: {
    embedded: true,
    canonicalization: "c14n-v1",
    messages: [
      { role: "user", content: "What are the three laws of robotics?" },
      { role: "assistant", content: "The Three Laws of Robotics, formulated by Isaac Asimov, are:\n\n1. A robot may not injure a human being or, through inaction, allow a human being to come to harm.\n2. A robot must obey the orders given it by human beings except where such orders would conflict with the First Law.\n3. A robot must protect its own existence as long as such protection does not conflict with the First or Second Law." },
    ],
  },
  transcript_hash_sha256: "bc69a63704dd02089b7c746ceb507b862fc8db449fd8ffaa6e7bba7e6811fd3d",
  signature: {
    alg: "Ed25519",
    public_key_id: "halo-demo-key-001",
    value: "Y9fS+Qa/c/GTgdKGiIZz8lkgxx2BBSB6nTIupFH3xi5iPRGJpkVgxJRp1cuvle2QKn41JqEyFuqk7U/NBZ5iDg==",
  },
  public_verify_url: `/api/proofpack/${DEMO_RECEIPT_ID}`,
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      time: new Date().toISOString(),
      version: ENGINE_ID,
    });
  });

  app.get("/api/ready", async (_req, res) => {
    const start = Date.now();
    let dbOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {}

    let auditHeadOk = false;
    try {
      const head = await storage.getAuditHead();
      auditHeadOk = head !== null || (await storage.getAuditEventCount()) === 0;
    } catch {}

    const status = dbOk && auditHeadOk ? "ok" : "degraded";
    const code = dbOk ? 200 : 503;
    logReadyCheck(Date.now() - start, status, dbOk, auditHeadOk);
    res.status(code).json({
      status,
      ready: dbOk,
      time: new Date().toISOString(),
      version: ENGINE_ID,
      db: { ok: dbOk },
      audit: { ok: auditHeadOk },
    });
  });

  app.get("/api/health/metrics", requireAuth, (_req, res) => {
    res.json({ counters: getCounters() });
  });

  app.post("/api/demo/seed", rateLimitPublic, async (_req, res) => {
    try {
      const existing = await storage.getReceipt(DEMO_RECEIPT_ID);
      if (existing) {
        return res.json({ status: "exists", receipt_id: DEMO_RECEIPT_ID, verification_status: existing.verificationStatus });
      }

      const c14nResult = canonicalize(DEMO_CAPSULE.transcript.messages);
      const computedHash = computeHash(c14nResult.canonical_transcript);
      const hashMatch = computedHash === DEMO_CAPSULE.transcript_hash_sha256;

      const sigResult = verifySignature(
        c14nResult.canonical_transcript,
        DEMO_CAPSULE.signature.value,
        DEMO_CAPSULE.signature.public_key_id
      );

      const capsuleCore = buildCapsuleCore(DEMO_CAPSULE);
      const receiptHashSha256 = computeReceiptHash(capsuleCore);

      let verificationStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED";
      if (!hashMatch) {
        verificationStatus = "UNVERIFIED";
      } else if (sigResult.status === "VALID") {
        verificationStatus = "VERIFIED";
      } else if (sigResult.status === "INVALID") {
        verificationStatus = "UNVERIFIED";
      } else {
        verificationStatus = "PARTIALLY_VERIFIED";
      }

      const internalId = randomUUID();
      const verifiedAt = new Date().toISOString();
      const forensics = computeForensics(DEMO_CAPSULE.transcript.messages, hashMatch, verificationStatus);

      await storage.createReceipt({
        id: internalId,
        receiptId: DEMO_RECEIPT_ID,
        platform: DEMO_CAPSULE.platform,
        capturedAt: DEMO_CAPSULE.captured_at,
        rawJson: JSON.stringify(DEMO_CAPSULE),
        forensicsJson: JSON.stringify(forensics),
        expectedHashSha256: DEMO_CAPSULE.transcript_hash_sha256,
        computedHashSha256: computedHash,
        hashMatch: hashMatch ? 1 : 0,
        signatureStatus: sigResult.status,
        signatureReason: sigResult.reason || null,
        signatureIssuerId: sigResult.issuer_id || null,
        signatureIssuerLabel: sigResult.issuer_label || null,
        signatureKeyStatus: sigResult.key_status || null,
        chainStatus: "GENESIS",
        previousReceiptId: null,
        receiptHashSha256,
        verificationStatus,
        verifiedAt,
        verificationEngineId: ENGINE_ID,
        immutableLock: verificationStatus !== "UNVERIFIED" ? 1 : 0,
        hindsightKillSwitch: 0,
        createdAt: verifiedAt,
      });

      await logAudit("demo_seed", { receiptId: DEMO_RECEIPT_ID, payload: { action: "demo_seed" } });

      res.json({ status: "seeded", receipt_id: DEMO_RECEIPT_ID, verification_status: verificationStatus });
    } catch (error) {
      console.error("Demo seed error:", error);
      apiError(res, 500, "Failed to seed demo receipt");
    }
  });

  app.get("/api/demo/receipt-id", (_req, res) => {
    res.json({ receipt_id: DEMO_RECEIPT_ID });
  });

  // P4: /api/verify requires auth (private ingest) + rate limited + input hardened
  // Public users can only GET /api/public/receipts/:id/verify (verify-by-id)
  // This prevents storage spam and database abuse from unauthenticated submissions
  // P7.2: inputHardening adds content-type validation, UTF-8 validation, size limits
  app.post("/api/verify", requireAuth, rateLimitVerify, inputHardening, async (req, res) => {
    try {
      const parseResult = verifyRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const validationError = fromError(parseResult.error);
        const result: VerifyResult = {
          schema: "ai-receipt/verify-result/1.0",
          request_id: req.body.request_id || randomUUID(),
          receipt_id: req.body.receipt_capsule?.receipt_id || "unknown",
          verification_engine: {
            engine_id: ENGINE_ID,
            verified_at: new Date().toISOString(),
          },
          integrity: {
            canonicalization: "c14n-v1",
            canonical_transcript: "",
            computed_hash_sha256: "",
            expected_hash_sha256: req.body.receipt_capsule?.transcript_hash_sha256 || "",
            hash_match: false,
            c14n_summary: {
              c14n_version: "c14n-v1",
              fields_hashed: ["role", "content"],
              message_count_hashed: 0,
              hash_input_bytes: 0,
            },
          },
          signature: {
            alg: "",
            public_key_id: "",
            status: "NO_SIGNATURE",
            reason: "Schema validation failed before signature check",
          },
          chain: {
            checked: false,
            status: "NOT_CHECKED",
            reason: "Schema validation failed",
          },
          receipt_hash_sha256: "",
          verification_status: "UNVERIFIED",
          failure_modes: [
            { code: "BAD_SCHEMA", message: validationError.message },
          ],
        };
        return res.status(400).json(result);
      }

      const { request_id, receipt_capsule, options } = parseResult.data;
      const requestId = request_id || randomUUID();
      const verifiedAt = new Date().toISOString();

      // P3: Canonicalization version lock - reject unknown versions
      const SUPPORTED_C14N_VERSIONS = ["c14n-v1"];
      const c14nVersion = receipt_capsule.transcript.canonicalization;
      if (!SUPPORTED_C14N_VERSIONS.includes(c14nVersion)) {
        const result: VerifyResult = {
          schema: "ai-receipt/verify-result/1.0",
          request_id: requestId,
          receipt_id: receipt_capsule.receipt_id,
          verification_engine: {
            engine_id: ENGINE_ID,
            verified_at: verifiedAt,
          },
          integrity: {
            canonicalization: "c14n-v1",
            canonical_transcript: "",
            computed_hash_sha256: "",
            expected_hash_sha256: receipt_capsule.transcript_hash_sha256,
            hash_match: false,
            c14n_summary: {
              c14n_version: "c14n-v1",
              fields_hashed: [],
              message_count_hashed: 0,
              hash_input_bytes: 0,
            },
          },
          signature: {
            alg: receipt_capsule.signature?.alg || "Ed25519",
            public_key_id: receipt_capsule.signature?.public_key_id || "",
            status: "NO_SIGNATURE",
            reason: "Verification aborted due to unknown canonicalization version",
          },
          chain: {
            checked: false,
            status: "NOT_CHECKED",
            reason: "Verification aborted due to unknown canonicalization version",
          },
          receipt_hash_sha256: "",
          verification_status: "UNVERIFIED",
          failure_modes: [
            { code: "UNKNOWN_CANONICALIZATION", message: `Unsupported canonicalization version: ${c14nVersion}. Supported: ${SUPPORTED_C14N_VERSIONS.join(", ")}` },
          ],
        };
        return res.status(400).json(result);
      }

      const c14nResult = canonicalize(receipt_capsule.transcript.messages);
      const computedHash = computeHash(c14nResult.canonical_transcript);
      const expectedHash = receipt_capsule.transcript_hash_sha256;
      const hashMatch = computedHash === expectedHash;

      const failureModes: Array<{ code: string; message: string }> = [];
      if (!hashMatch) {
        failureModes.push({
          code: "HASH_MISMATCH",
          message: `Computed hash ${computedHash} does not match expected hash ${expectedHash}`,
        });
      }

      // Signature verification using key registry
      // No SKIPPED status allowed - if signature verification is bypassed, result is UNVERIFIED
      let sigResult: SignatureVerificationResult;
      let signatureNotVerified = false;
      if (options?.verify_signature === false) {
        // Caller requested skip - treat as NO_SIGNATURE but mark for UNVERIFIED
        sigResult = {
          status: "NO_SIGNATURE",
          reason: "Signature verification bypassed by request",
        };
        signatureNotVerified = true;
      } else if (!receipt_capsule.signature?.value || !receipt_capsule.signature?.public_key_id) {
        sigResult = {
          status: "NO_SIGNATURE",
          reason: "No signature or public_key_id provided in receipt",
        };
      } else {
        sigResult = verifySignature(
          c14nResult.canonical_transcript,
          receipt_capsule.signature.value,
          receipt_capsule.signature.public_key_id
        );
      }

      // Compute receipt_hash_sha256 from canonicalized capsule core
      const capsuleCore = buildCapsuleCore(receipt_capsule);
      const receiptHashSha256 = computeReceiptHash(capsuleCore);

      // Chain verification
      let chainResult: ChainVerificationResult;
      if (options?.verify_chain !== true) {
        chainResult = {
          checked: false,
          status: "NOT_CHECKED",
          reason: "Chain verification not requested",
        };
      } else {
        const claimedPreviousHash = receipt_capsule.previous_receipt_hash_sha256;
        if (!claimedPreviousHash) {
          chainResult = verifyChainLink(undefined, undefined, undefined);
        } else {
          // Look up previous receipt by computing receipt_hash for each stored receipt
          const allReceipts = await storage.getAllReceipts();
          let storedPreviousReceiptHash: string | undefined;
          let previousReceiptId: string | undefined;
          
          for (const r of allReceipts) {
            // Rebuild capsule core from stored receipt to compute its receipt_hash
            const storedRawCapsule = JSON.parse(r.rawJson);
            const storedCapsuleCore = buildCapsuleCore(storedRawCapsule);
            const storedReceiptHash = computeReceiptHash(storedCapsuleCore);
            
            if (storedReceiptHash === claimedPreviousHash) {
              storedPreviousReceiptHash = storedReceiptHash;
              previousReceiptId = r.receiptId;
              break;
            }
          }
          
          chainResult = verifyChainLink(claimedPreviousHash, storedPreviousReceiptHash, previousReceiptId);
        }
      }

      // Determine verification status based on hash, signature, and chain
      // Deterministic logic per P2 spec:
      // 1. hash_match false → UNVERIFIED
      // 2. signature INVALID → UNVERIFIED
      // 3. chain BROKEN (and previous hash was provided) → UNVERIFIED
      // 4. signature bypass requested → UNVERIFIED (no silent bypass)
      // 5. signature VALID + chain ok → VERIFIED
      // 6. else (hash ok but signature missing/untrusted) → PARTIALLY_VERIFIED
      let verificationStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED";
      if (!hashMatch) {
        verificationStatus = "UNVERIFIED";
      } else if (sigResult.status === "INVALID") {
        verificationStatus = "UNVERIFIED";
        failureModes.push({ code: "BAD_SIGNATURE", message: sigResult.reason });
      } else if (chainResult.status === "BROKEN") {
        verificationStatus = "UNVERIFIED";
        failureModes.push({ code: "CHAIN_BROKEN", message: chainResult.reason });
      } else if (signatureNotVerified) {
        // Caller requested signature bypass - no silent bypass allowed
        verificationStatus = "UNVERIFIED";
        failureModes.push({ code: "SIGNATURE_NOT_VERIFIED", message: "Signature verification was bypassed by request" });
      } else if (sigResult.status === "VALID" && (chainResult.status === "LINKED" || chainResult.status === "GENESIS" || chainResult.status === "NOT_CHECKED")) {
        verificationStatus = "VERIFIED";
      } else {
        // Hash matches but signature is UNTRUSTED_ISSUER or NO_SIGNATURE
        verificationStatus = "PARTIALLY_VERIFIED";
      }

      const internalId = randomUUID();
      const immutableLock = verificationStatus !== "UNVERIFIED" ? 1 : 0;

      const forensics = computeForensics(receipt_capsule.transcript.messages, hashMatch, verificationStatus);

      await storage.createReceipt({
        id: internalId,
        receiptId: receipt_capsule.receipt_id,
        platform: receipt_capsule.platform,
        capturedAt: receipt_capsule.captured_at,
        rawJson: JSON.stringify(receipt_capsule),
        forensicsJson: JSON.stringify(forensics),
        expectedHashSha256: expectedHash,
        computedHashSha256: computedHash,
        hashMatch: hashMatch ? 1 : 0,
        signatureStatus: sigResult.status,
        signatureReason: sigResult.reason,
        signatureIssuerId: sigResult.issuer_id || null,
        signatureIssuerLabel: sigResult.issuer_label || null,
        signatureKeyStatus: sigResult.key_status || null,
        chainStatus: chainResult.status,
        previousReceiptId: chainResult.previous_receipt_id || null,
        receiptHashSha256: receiptHashSha256,
        verificationStatus,
        verifiedAt,
        verificationEngineId: ENGINE_ID,
        immutableLock,
        hindsightKillSwitch: 0,
        createdAt: new Date().toISOString(),
      });

      logMilestone(
        "VERIFY_STORED",
        `Receipt verified and stored with status: ${verificationStatus}`,
        []
      );

      // P5: Generate research record if consent is given
      // This is a write-once pipeline hook - failure does NOT affect verification response
      if (options?.research_consent) {
        const consent = options.research_consent;
        const hasAnyConsent = 
          consent.anonymized_statistics ||
          consent.model_behavior_research ||
          consent.academic_publication ||
          consent.commercial_datasets;

        if (hasAnyConsent) {
          try {
            const researchRecord = buildResearchRecord(
              {
                verificationStatus,
                signatureStatus: sigResult.status,
                signatureKeyStatus: sigResult.key_status,
                chainStatus: chainResult.status,
                platform: receipt_capsule.platform,
                capturedAt: receipt_capsule.captured_at,
                verifiedAt,
                killSwitchEngaged: false,
                interpretationCount: 0,
              },
              forensics,
              {
                consented: true,
                scope: consent,
                version: "1.0",
                consentedAt: verifiedAt,
              }
            );
            const dbRecord = toDbFormat(researchRecord);
            await storage.createResearchRecord(dbRecord);
            logMilestone(
              "RESEARCH_RECORD_WRITTEN",
              `Anonymized research record created with consent scope`,
              []
            );
          } catch (researchError) {
            // Log but don't fail verification
            console.error("Research record generation failed (non-fatal):", researchError);
          }
        }
      }

      const result: VerifyResult = {
        schema: "ai-receipt/verify-result/1.0",
        request_id: requestId,
        receipt_id: receipt_capsule.receipt_id,
        verification_engine: {
          engine_id: ENGINE_ID,
          verified_at: verifiedAt,
        },
        integrity: {
          canonicalization: "c14n-v1",
          canonical_transcript: c14nResult.canonical_transcript,
          computed_hash_sha256: computedHash,
          expected_hash_sha256: expectedHash,
          hash_match: hashMatch,
          c14n_summary: {
            c14n_version: c14nResult.c14n_version,
            fields_hashed: c14nResult.fields_hashed,
            message_count_hashed: c14nResult.message_count_hashed,
            hash_input_bytes: c14nResult.hash_input_bytes,
          },
        },
        signature: {
          alg: receipt_capsule.signature?.alg || "Ed25519",
          public_key_id: receipt_capsule.signature?.public_key_id || "",
          status: sigResult.status,
          reason: sigResult.reason,
          issuer_id: sigResult.issuer_id,
          issuer_label: sigResult.issuer_label,
          key_status: sigResult.key_status,
          trusted: sigResult.trusted,
        },
        chain: {
          checked: chainResult.checked,
          status: chainResult.status,
          reason: chainResult.reason,
          previous_receipt_id: chainResult.previous_receipt_id,
          expected_previous_hash: chainResult.expected_previous_hash,
          observed_previous_hash: chainResult.observed_previous_hash,
          link_match: chainResult.link_match,
        },
        receipt_hash_sha256: receiptHashSha256,
        verification_status: verificationStatus,
        failure_modes: failureModes,
        forensics,
      };

      res.json(result);
    } catch (error) {
      console.error("Verify error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // P4: Private endpoint - requires auth
  app.get("/api/receipts", requireAuth, async (_req, res) => {
    try {
      const allReceipts = await storage.getAllReceipts();
      res.json(allReceipts);
    } catch (error) {
      console.error("Get receipts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/receipts/paged", requireAuth, async (req, res) => {
    try {
      const VALID_STATUSES = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED"];

      let page = parseInt(req.query.page as string) || 1;
      if (page < 1) page = 1;

      let pageSize = parseInt(req.query.pageSize as string) || 50;
      if (pageSize < 1) pageSize = 1;
      if (pageSize > 200) pageSize = 200;

      const statusParam = req.query.status as string | undefined;
      if (statusParam && !VALID_STATUSES.includes(statusParam)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const q = req.query.q as string | undefined;

      let hasForensics: boolean | undefined;
      if (req.query.hasForensics !== undefined) {
        const val = (req.query.hasForensics as string).toLowerCase();
        if (val === "true") hasForensics = true;
        else if (val === "false") hasForensics = false;
        else return res.status(400).json({ error: "Invalid hasForensics" });
      }

      let killSwitch: boolean | undefined;
      if (req.query.killSwitch !== undefined) {
        const val = (req.query.killSwitch as string).toLowerCase();
        if (val === "true") killSwitch = true;
        else if (val === "false") killSwitch = false;
        else return res.status(400).json({ error: "Invalid killSwitch" });
      }

      const order = (req.query.order as string || "desc").toLowerCase();
      if (order !== "asc" && order !== "desc") {
        return res.status(400).json({ error: "Invalid order" });
      }

      const result = await storage.getPagedReceipts({
        page,
        pageSize,
        status: statusParam,
        q: q || undefined,
        hasForensics,
        killSwitch,
        order: order as "asc" | "desc",
      });

      res.json(result);
    } catch (error) {
      console.error("Get paged receipts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk Export: create export job
  app.post("/api/receipts/bulk-export", requireAuth, async (req, res) => {
    try {
      const parsed = bulkExportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromError(parsed.error).toString() });
      }

      const { scope, page, pageSize, status, q, hasForensics, killSwitch, confirm } = parsed.data;

      const VALID_STATUSES = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED"];
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid status filter" });
      }

      const filters = { status, q, hasForensics, killSwitch };
      const now = new Date();
      const requestedAt = now.toISOString();

      const preview = await storage.getPagedReceipts({
        page: 1,
        pageSize: scope === "current_page" ? (pageSize || 50) : 1,
        status: filters.status,
        q: filters.q,
        hasForensics: filters.hasForensics,
        killSwitch: filters.killSwitch,
        order: "desc",
        beforeDate: requestedAt,
      });

      let piiCount = 0;
      let killCount = 0;

      if (scope === "current_page") {
        const previewPage = await storage.getPagedReceipts({
          page: page || 1,
          pageSize: pageSize || 50,
          status: filters.status,
          q: filters.q,
          hasForensics: filters.hasForensics,
          killSwitch: filters.killSwitch,
          order: "desc",
          beforeDate: requestedAt,
        });
        for (const r of previewPage.items) {
          if (r.hindsightKillSwitch === 1) killCount++;
          if (r.forensicsJson) {
            try {
              const f = typeof r.forensicsJson === "object" ? r.forensicsJson : JSON.parse(r.forensicsJson);
              if (f?.pii_detection?.pii_detected) piiCount++;
            } catch {}
          }
        }
      } else {
        const scanSize = Math.min(preview.total, 500);
        const scanResult = await storage.getPagedReceipts({
          page: 1,
          pageSize: scanSize,
          status: filters.status,
          q: filters.q,
          hasForensics: filters.hasForensics,
          killSwitch: filters.killSwitch,
          order: "desc",
          beforeDate: requestedAt,
        });
        for (const r of scanResult.items) {
          if (r.hindsightKillSwitch === 1) killCount++;
          if (r.forensicsJson) {
            try {
              const f = typeof r.forensicsJson === "object" ? r.forensicsJson : JSON.parse(r.forensicsJson);
              if (f?.pii_detection?.pii_detected) piiCount++;
            } catch {}
          }
        }
      }

      if ((piiCount > 0 || killCount > 0) && !confirm) {
        await logAudit("EXPORT_CONFIRM_REQUIRED", {
          payload: { scope, filters, riskCounts: { pii: piiCount, killSwitch: killCount }, total: preview.total },
          req,
        });
        return res.status(409).json({
          code: "CONFIRM_REQUIRED",
          message: "Export contains receipts with sensitive flags. Re-submit with confirm:true to proceed.",
          riskCounts: { piiCount, killCount },
          totalMatching: preview.total,
        });
      }

      if (confirm) {
        await logAudit("EXPORT_CONFIRMED", { payload: { scope, filters }, req });
      } else {
        await logAudit("EXPORT_REQUESTED", { payload: { scope, filters, total: preview.total }, req });
      }

      const exportId = `exp-${randomUUID()}`;
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      await storage.createExportJob({
        exportId,
        status: "QUEUED",
        scope,
        filtersJson: JSON.stringify(filters),
        total: 0,
        completed: 0,
        createdAt: requestedAt,
        expiresAt: expiresAt.toISOString(),
      });

      await logAudit("EXPORT_QUEUED", { exportId, payload: { scope, filters }, req });

      generateBulkExport(exportId, scope, filters, requestedAt, expiresAt.toISOString(), page, pageSize).catch(err => {
        console.error("Bulk export background error:", err);
      });

      res.json({ exportId, status: "QUEUED" });
    } catch (error) {
      console.error("Bulk export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk Export: get job status
  app.get("/api/exports/:exportId", requireAuth, async (req, res) => {
    try {
      const job = await storage.getExportJob(req.params.exportId as string);
      if (!job) {
        return res.status(404).json({ error: "Export not found" });
      }

      res.json({
        exportId: job.exportId,
        status: job.status,
        total: job.total,
        completed: job.completed,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
        errorMessage: job.status === "FAILED" ? job.errorMessage : undefined,
      });
    } catch (error) {
      console.error("Get export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Bulk Export: download ZIP
  app.get("/api/exports/:exportId/download", requireAuth, async (req, res) => {
    try {
      const job = await storage.getExportJob(req.params.exportId as string);
      if (!job) {
        return res.status(404).json({ error: "Export not found" });
      }

      if (job.status !== "READY") {
        return res.status(409).json({ error: "Export not ready", status: job.status });
      }

      const filePath = getExportFilePath(job.exportId);
      const exists = await exportFileExists(job.exportId);
      if (!exists) {
        return res.status(410).json({ error: "Export file expired or missing" });
      }

      await logAudit("EXPORT_DOWNLOADED", { exportId: job.exportId, req });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="receipts-export-${job.exportId}.zip"`);
      const { createReadStream } = await import("fs");
      const stream = createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      console.error("Download export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // P4: Private endpoint - requires auth
  app.get("/api/receipts/:receiptId", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const interpretationsList = await storage.getInterpretations(receiptId as string);
      
      let rawCapsule: any = {};
      try {
        rawCapsule = JSON.parse(receipt.rawJson);
      } catch {}

      // Apply transcript mode to response
      let processedCapsule = rawCapsule;
      if (TRANSCRIPT_MODE === "hidden") {
        processedCapsule = rawCapsule ? {
          ...rawCapsule,
          transcript: {
            ...rawCapsule.transcript,
            messages: "[HIDDEN - Transcript mode is set to hidden]",
          }
        } : null;
      } else if (TRANSCRIPT_MODE === "redacted" && rawCapsule?.transcript?.messages) {
        processedCapsule = {
          ...rawCapsule,
          transcript: {
            ...rawCapsule.transcript,
            messages: rawCapsule.transcript.messages.map((msg: any) => ({
              ...msg,
              content: redactPii(msg.content || ""),
            })),
          }
        };
      }

      res.json({
        receipt,
        interpretations: interpretationsList,
        rawCapsule: processedCapsule,
        transcriptMode: TRANSCRIPT_MODE,
      });
    } catch (error) {
      console.error("Get receipt error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // P4: Private endpoint - requires auth
  app.post("/api/receipts/:receiptId/kill", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receiptIdStr = Array.isArray(receiptId) ? receiptId[0] : receiptId;
      const updated = await storage.updateReceiptKillSwitch(receiptIdStr);
      if (!updated) {
        return res.status(404).json({ error: "Receipt not found" });
      }
      logMilestone(
        "KILL_SWITCH_ENGAGED",
        `Kill switch engaged for receipt, permanently blocking interpretation and observation`,
        []
      );
      res.json(updated);
    } catch (error) {
      console.error("Kill switch error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Transcript mode configuration endpoint
  // P4: Private endpoint - requires auth
  app.get("/api/config/transcript-mode", requireAuth, (_req, res) => {
    res.json({ 
      mode: TRANSCRIPT_MODE,
      description: TRANSCRIPT_MODE === "full" 
        ? "Raw submitted transcript (may contain sensitive information)" 
        : TRANSCRIPT_MODE === "redacted"
        ? "Transcript with PII patterns redacted"
        : "Transcript hidden - only hashes and forensics counts visible"
    });
  });

  // Export report endpoint
  // P4: Private endpoint - requires auth
  app.get("/api/receipts/:receiptId/export", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      await logAudit("RECEIPT_EXPORTED", { receiptId: receiptId as string, req });

      const interpretations = await storage.getInterpretations(receiptId as string);
      
      let rawCapsule: any = null;
      try {
        rawCapsule = JSON.parse(receipt.rawJson);
      } catch (e) {
        rawCapsule = null;
      }

      // Parse forensics
      let forensics: ForensicsResult | null = null;
      try {
        forensics = receipt.forensicsJson ? JSON.parse(receipt.forensicsJson) : null;
      } catch (e) {
        forensics = null;
      }

      // Build verify result from stored receipt data
      const c14nResult = rawCapsule?.transcript?.messages 
        ? canonicalize(rawCapsule.transcript.messages) 
        : { canonical_transcript: "", c14n_version: "c14n-v1" as const, fields_hashed: ["role", "content"], message_count_hashed: 0, hash_input_bytes: 0 };

      const verifyResult: VerifyResult = {
        schema: "ai-receipt/verify-result/1.0",
        request_id: receipt.id,
        receipt_id: receipt.receiptId,
        verification_engine: {
          engine_id: receipt.verificationEngineId,
          verified_at: receipt.verifiedAt,
        },
        integrity: {
          canonicalization: "c14n-v1",
          canonical_transcript: TRANSCRIPT_MODE === "hidden" ? "[HIDDEN]" : 
            TRANSCRIPT_MODE === "redacted" ? redactPii(c14nResult.canonical_transcript) : c14nResult.canonical_transcript,
          computed_hash_sha256: receipt.computedHashSha256,
          expected_hash_sha256: receipt.expectedHashSha256,
          hash_match: receipt.hashMatch === 1,
          c14n_summary: {
            c14n_version: c14nResult.c14n_version,
            fields_hashed: c14nResult.fields_hashed,
            message_count_hashed: c14nResult.message_count_hashed,
            hash_input_bytes: c14nResult.hash_input_bytes,
          },
        },
        signature: {
          alg: rawCapsule?.signature?.alg || "",
          public_key_id: rawCapsule?.signature?.public_key_id || "",
          status: receipt.signatureStatus as any,
          reason: receipt.signatureReason || "",
        },
        chain: {
          checked: false,
          status: "NOT_CHECKED",
          reason: "Chain verification not available in export",
        },
        receipt_hash_sha256: rawCapsule ? computeReceiptHash(buildCapsuleCore(rawCapsule)) : "",
        verification_status: receipt.verificationStatus as any,
        failure_modes: receipt.hashMatch === 0 ? [{ code: "HASH_MISMATCH", message: "Hash mismatch detected" }] : [],
        forensics: forensics || undefined,
      };

      // Build export report
      const exportReport: ExportReport = {
        schema: "ai-receipt/export/1.0",
        receipt_id: receipt.receiptId,
        exported_at: new Date().toISOString(),
        export_mode: TRANSCRIPT_MODE,
        verify_result: verifyResult,
        forensics: forensics!,
        interpretations,
      };

      // Include raw capsule only if not hidden
      if (TRANSCRIPT_MODE !== "hidden" && rawCapsule) {
        if (TRANSCRIPT_MODE === "redacted") {
          // Deep copy and redact PII from messages
          const redactedCapsule = JSON.parse(JSON.stringify(rawCapsule));
          if (redactedCapsule.transcript?.messages) {
            redactedCapsule.transcript.messages = redactedCapsule.transcript.messages.map((msg: any) => ({
              ...msg,
              content: redactPii(msg.content || ""),
            }));
          }
          exportReport.capsule_raw_json = JSON.stringify(redactedCapsule);
        } else {
          exportReport.capsule_raw_json = receipt.rawJson;
        }
      }

      res.json(exportReport);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // P4: Private endpoint - requires auth
  app.post("/api/receipts/:receiptId/interpret", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (receipt.verificationStatus === "UNVERIFIED") {
        return res.status(403).json({ error: "Cannot interpret unverified receipts" });
      }

      if (receipt.hindsightKillSwitch === 1) {
        return res.status(403).json({ error: "Kill switch engaged - interpretation disabled" });
      }

      if (receipt.immutableLock === 0 && !receipt.verificationStatus) {
        return res.status(409).json({ error: "Receipt must be verified first" });
      }

      const parseResult = interpretRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const validationError = fromError(parseResult.error);
        return res.status(400).json({ error: validationError.message });
      }

      const { model_id, question, kind } = parseResult.data;
      
      const content = `[${receipt.verificationStatus}] Interpretation Engine Stub Response:\n\nQuestion: ${question}\n\nThis is a stub response. The interpretation engine is not configured. To enable real interpretations, configure an LLM provider.`;

      const interpretation = await storage.createInterpretation({
        id: randomUUID(),
        receiptId: receiptId as string,
        modelId: model_id,
        kind,
        content,
        createdAt: new Date().toISOString(),
        verificationStatusAtTime: receipt.verificationStatus,
        hashAtTime: receipt.computedHashSha256,
      });

      res.json(interpretation);
    } catch (error) {
      console.error("Interpret error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // P4: Private endpoint - requires auth
  app.post("/api/receipts/:receiptId/tri-sensor", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (receipt.verificationStatus === "UNVERIFIED") {
        return res.status(403).json({ error: "Cannot analyze unverified receipts" });
      }

      if (receipt.hindsightKillSwitch === 1) {
        return res.status(403).json({ error: "Kill switch engaged - analysis disabled" });
      }

      const triSensorResult: TriSensorResult = {
        interpreter: {
          output: "UNCERTAINTY: Interpreter sensor unavailable - no LLM API key configured",
          available: false,
        },
        summarizer: {
          output: "UNCERTAINTY: Summarizer sensor unavailable - no LLM API key configured",
          available: false,
        },
        claimExtractor: {
          output: "UNCERTAINTY: Claim extractor sensor unavailable - no LLM API key configured",
          available: false,
        },
        disagreement_detected: false,
      };

      const interpretation = await storage.createInterpretation({
        id: randomUUID(),
        receiptId: receiptId as string,
        modelId: "tri-sensor:stub",
        kind: "tri_sensor",
        content: JSON.stringify(triSensorResult),
        createdAt: new Date().toISOString(),
        verificationStatusAtTime: receipt.verificationStatus,
        hashAtTime: receipt.computedHashSha256,
      });

      res.json(triSensorResult);
    } catch (error) {
      console.error("Tri-sensor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================================================
  // P6: LLM OBSERVATION ENDPOINTS (SENSOR MODE ONLY)
  // LLMs observe and describe, they NEVER judge truth/validity
  // These endpoints are DATA-ISOLATED from verification/forensics
  // =============================================================================

  /**
   * Generate LLM observation for a receipt
   * CRITICAL: LLM sees ONLY transcript, never verification data
   */
  app.post("/api/receipts/:receiptId/observe", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      // Kill switch blocks LLM observations too
      if (receipt.hindsightKillSwitch === 1) {
        // P7.5: Log kill switch engagement block
        logKillSwitch(receiptId as string);
        return res.status(403).json({ error: "Kill switch engaged - observations disabled" });
      }

      // Validate request using Zod schema
      const parseResult = llmObservationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const validationError = fromError(parseResult.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { observation_type, model_id } = parseResult.data;

      // Extract transcript (DATA ISOLATION: LLM never sees verification results)
      let transcript: Array<{ role: string; content: string }> = [];
      try {
        const capsule = JSON.parse(receipt.rawJson);
        transcript = capsule.transcript?.messages || [];
      } catch {
        return res.status(400).json({ error: "Cannot parse receipt transcript" });
      }

      // P7.4: Prompt injection detection (non-blocking flag only)
      const transcriptText = transcript.map(m => m.content).join(" ");
      const injectionMatches = detectPromptInjection(transcriptText);
      if (injectionMatches.length > 0) {
        // Log for audit purposes only - do NOT block
        logPromptInjectionFlag(receiptId as string, injectionMatches[0], observation_type);
      }

      // Use sensor pipeline for proper adapter dispatch
      const { runSensorPipeline, SensorPipelineError, normalizeModelId } = await import("./llm/sensor-pipeline");
      
      const modelIdToUse = normalizeModelId(model_id || "mock-sensor");
      const basis = receipt.verificationStatus === "VERIFIED" || receipt.verificationStatus === "PARTIALLY_VERIFIED"
        ? "verified_transcript" as const
        : "submitted_transcript" as const;
      
      const result = await runSensorPipeline({
        receiptId: receiptId as string,
        transcript: { messages: transcript },
        basis,
        observationType: observation_type,
        modelId: modelIdToUse,
      }, receipt.hindsightKillSwitch === 1);
      
      if (!result.success) {
        return res.status(result.error.status).json({ 
          error: result.error.message,
          code: result.error.code,
          retryable: result.error.retryable,
        });
      }
      
      const observation = result.observation;

      // Store observation (separate from interpretations)
      await storage.createLlmObservation({
        observationId: observation.observation_id,
        receiptId: receiptId as string,
        modelId: observation.model_id,
        observationType: observation.observation_type,
        basedOn: observation.based_on,
        content: observation.content,
        confidenceStatement: observation.confidence_statement,
        limitations: JSON.stringify(observation.limitations),
        createdAt: observation.created_at,
      });

      logMilestone(
        "OBSERVE_CREATED",
        `LLM observation created: type=${observation_type}, model=${modelIdToUse}`,
        []
      );

      res.json(observation);
    } catch (error) {
      console.error("LLM observation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Get all LLM observations for a receipt
   * These are SEPARATE from interpretations and verification data
   */
  app.get("/api/receipts/:receiptId/observations", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      const observations = await storage.getLlmObservations(receiptId as string);

      // Kill switch: hide observations
      if (receipt.hindsightKillSwitch === 1) {
        return res.json({
          schema: "llm-observations-list/1.0",
          receipt_id: receiptId,
          kill_switch_engaged: true,
          observations: [],
          note: "Kill switch engaged - observations hidden",
        });
      }

      // Transform to API format
      const formattedObservations = observations.map(o => ({
        schema: "llm-observation/1.0",
        observation_id: o.observationId,
        model_id: o.modelId,
        observation_type: o.observationType,
        based_on: o.basedOn,
        content: o.content,
        confidence_statement: o.confidenceStatement,
        limitations: JSON.parse(o.limitations),
        created_at: o.createdAt,
      }));

      res.json({
        schema: "llm-observations-list/1.0",
        receipt_id: receiptId,
        kill_switch_engaged: false,
        observation_count: formattedObservations.length,
        observations: formattedObservations,
      });
    } catch (error) {
      console.error("Get observations error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * Multi-model observation for disagreement detection
   * Shows how models differ WITHOUT reconciliation
   */
  app.post("/api/receipts/:receiptId/observe/multi", requireAuth, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        return res.status(404).json({ error: "Receipt not found" });
      }

      if (receipt.hindsightKillSwitch === 1) {
        // P7.5: Log kill switch block
        logKillSwitch(receiptId as string);
        return res.status(403).json({ error: "Kill switch engaged - observations disabled" });
      }

      // Validate request using Zod schema
      const parseResult = multiModelObservationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const validationError = fromError(parseResult.error);
        return res.status(400).json({ error: validationError.message });
      }
      
      const { observation_type, model_ids } = parseResult.data;

      // Extract transcript (DATA ISOLATION)
      let transcript: Array<{ role: string; content: string }> = [];
      try {
        const capsule = JSON.parse(receipt.rawJson);
        transcript = capsule.transcript?.messages || [];
      } catch {
        return res.status(400).json({ error: "Cannot parse receipt transcript" });
      }

      // P7.4: Prompt injection detection (non-blocking flag only)
      const transcriptText = transcript.map(m => m.content).join(" ");
      const injectionMatches = detectPromptInjection(transcriptText);
      if (injectionMatches.length > 0) {
        // Log for audit purposes only - do NOT block
        logPromptInjectionFlag(receiptId as string, injectionMatches[0], observation_type);
      }

      // Use sensor pipeline for proper adapter dispatch
      const { runMultiModelPipeline, normalizeModelId } = await import("./llm/sensor-pipeline");
      
      const basis = receipt.verificationStatus === "VERIFIED" || receipt.verificationStatus === "PARTIALLY_VERIFIED"
        ? "verified_transcript" as const
        : "submitted_transcript" as const;
      
      const normalizedModelIds = model_ids.map(id => normalizeModelId(id));
      
      const multiResult = await runMultiModelPipeline({
        receiptId: receiptId as string,
        transcript: { messages: transcript },
        basis,
        observationType: observation_type,
        modelIds: normalizedModelIds,
      }, receipt.hindsightKillSwitch === 1);
      
      // Handle complete failure (kill switch or all models failed)
      if (multiResult.kill_switch_engaged) {
        return res.status(403).json({
          schema: "llm-multi-observation/1.0",
          receipt_id: receiptId as string,
          observation_type,
          kill_switch_engaged: true,
          model_results: multiResult.model_results,
          observations: [],
          errors: multiResult.errors,
          disagreement: multiResult.disagreement,
        });
      }

      // Store successful observations
      for (const observation of multiResult.observations) {
        await storage.createLlmObservation({
          observationId: observation.observation_id,
          receiptId: receiptId as string,
          modelId: observation.model_id,
          observationType: observation.observation_type,
          basedOn: observation.based_on,
          content: observation.content,
          confidenceStatement: observation.confidence_statement,
          limitations: JSON.stringify(observation.limitations),
          createdAt: observation.created_at,
        });
      }

      logMilestone(
        "OBSERVE_MULTI_CREATED",
        `Multi-model observation created: type=${observation_type}, models=${model_ids.length}, succeeded=${multiResult.disagreement.models_succeeded}`,
        []
      );

      // Build per-model display objects with non-authoritative phrasing
      const modelObservationDisplay = multiResult.model_results.map(r => {
        if (r.success && r.observation) {
          return {
            model_id: r.model_id,
            status: "observed" as const,
            said: r.observation.content, // "Model A said..." phrasing
            observation: r.observation,
          };
        } else {
          return {
            model_id: r.model_id,
            status: "error" as const,
            error_code: r.error?.code,
            error_message: r.error?.message,
          };
        }
      });

      res.json({
        schema: "llm-multi-observation/1.0",
        receipt_id: receiptId as string,
        observation_type,
        kill_switch_engaged: false,
        // Per-model results with "said" phrasing (non-authoritative)
        model_observations: modelObservationDisplay,
        // Raw observations for storage/processing
        observations: multiResult.observations,
        // Per-model errors with canonical codes
        errors: multiResult.errors,
        // Disagreement descriptor (no ranking, no resolution)
        disagreement: multiResult.disagreement,
      });
    } catch (error) {
      console.error("Multi-model observation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * P3.3 Public Verification Endpoint
   * 
   * Returns verify-result + chain + forensics but strictly respects TRANSCRIPT_MODE.
   * Never leaks raw transcript in public mode unless explicitly configured.
   * 
   * This endpoint is designed for sharing verification results safely.
   */
  // P4: Public endpoint - rate limited but no auth required
  // P6.6: Hardened with deterministic response envelope and contract metadata
  app.get("/api/public/receipts/:receiptId/verify", rateLimitPublic, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        const errorResponse = createPublicError(
          PUBLIC_ERROR_CODES.RECEIPT_NOT_FOUND,
          "Receipt not found",
          { receipt_id: receiptId }
        );
        return res.status(404).json(errorResponse);
      }

      // Allow test mode override in development only (for P3 evidence testing)
      let effectiveMode: TranscriptMode = TRANSCRIPT_MODE;
      const testMode = req.query._test_mode as string;
      if (process.env.NODE_ENV !== "production" && testMode && VALID_TRANSCRIPT_MODES.includes(testMode as TranscriptMode)) {
        effectiveMode = testMode as TranscriptMode;
      }

      let rawCapsule: any = {};
      try {
        rawCapsule = JSON.parse(receipt.rawJson);
      } catch {}

      // Build chain summary from stored data
      const chainSummary = {
        status: receipt.chainStatus || "NOT_CHECKED",
        previous_receipt_id: receipt.previousReceiptId || null,
        is_genesis: !receipt.previousReceiptId && receipt.chainStatus === "GENESIS",
      };

      // Build signature summary from stored data
      const signatureSummary = {
        status: receipt.signatureStatus || "NO_SIGNATURE",
        public_key_id: rawCapsule.signature?.public_key_id || null,
        issuer_id: receipt.signatureIssuerId || null,
        issuer_label: receipt.signatureIssuerLabel || null,
        key_status: receipt.signatureKeyStatus || null,
      };

      // Build integrity summary
      const integritySummary = {
        hash_match: receipt.hashMatch === 1,
        computed_hash_sha256: receipt.computedHashSha256,
        expected_hash_sha256: rawCapsule.transcript_hash_sha256 || null,
        receipt_hash_sha256: receipt.receiptHashSha256 || null,
      };

      // Parse forensics if available
      let forensicsSummary = null;
      if (receipt.forensicsJson) {
        try {
          const fullForensics = JSON.parse(receipt.forensicsJson);
          // Provide forensics summary without raw content
          forensicsSummary = {
            schema: fullForensics.schema,
            forensics_engine_id: fullForensics.forensics_engine_id,
            forensics_ran_at: fullForensics.forensics_ran_at,
            detectors_ran: fullForensics.detectors_ran,
            based_on: fullForensics.based_on,
            integrity_context: fullForensics.integrity_context,
            transcript_stats: fullForensics.transcript_stats,
            risk_keywords: fullForensics.risk_keywords,
            pii_heuristics: fullForensics.pii_heuristics,
            structural_anomalies: fullForensics.structural_anomalies,
            anomalies: fullForensics.anomalies,
          };
        } catch {}
      }

      // Build transcript view based on effective transcript mode
      // Contract: { mode, included, content? } - unambiguous structure
      let transcriptView: {
        mode: "full" | "redacted" | "hidden";
        included: boolean;
        message_count: number;
        content?: Array<{ role: string; content: string }>;
      };
      
      if (effectiveMode === "full") {
        transcriptView = {
          mode: "full",
          included: true,
          message_count: rawCapsule.transcript?.messages?.length || 0,
          content: rawCapsule.transcript?.messages || [],
        };
      } else if (effectiveMode === "redacted") {
        transcriptView = {
          mode: "redacted",
          included: true,
          message_count: rawCapsule.transcript?.messages?.length || 0,
          content: rawCapsule.transcript?.messages?.map((msg: any) => ({
            role: msg.role,
            content: redactPii(msg.content || ""),
          })) || [],
        };
      } else {
        // hidden mode - no transcript exposed, no content field at all
        transcriptView = {
          mode: "hidden",
          included: false,
          message_count: rawCapsule.transcript?.messages?.length || 0,
        };
      }

      // Build public result - NEVER include rawCapsule in hidden mode
      // P6.6: Deterministic response envelope with contract metadata
      const publicResult = {
        schema: "ai-receipt/public-verify/1.0",
        receipt_id: receipt.receiptId,
        platform: receipt.platform,
        captured_at: receipt.capturedAt,
        verified_at: receipt.verifiedAt,
        verification_status: receipt.verificationStatus,
        kill_switch_engaged: receipt.hindsightKillSwitch === 1,
        integrity: integritySummary,
        signature: signatureSummary,
        chain: chainSummary,
        transcript: transcriptView,
        forensics: forensicsSummary,
        // P6.6: Contract metadata - always present for audit (corrected)
        _contract: {
          transcript_mode_is_display_only: TRANSCRIPT_MODE_CONTRACT.is_display_mode,
          raw_transcript_persisted: TRANSCRIPT_MODE_CONTRACT.raw_transcript_persisted,
          integrity_proofs_persisted: TRANSCRIPT_MODE_CONTRACT.integrity_proofs_persisted,
          observations_excluded: true,
          research_data_excluded: true,
        },
      };

      res.json(publicResult);
    } catch (error) {
      console.error("Public verify error:", error);
      const errorResponse = createPublicError(
        PUBLIC_ERROR_CODES.INTERNAL_ERROR,
        "Internal server error"
      );
      res.status(500).json(errorResponse);
    }
  });

  // ==========================================================================
  // P6.7: PUBLIC VERIFICATION PROOF PACK ENDPOINT
  // ==========================================================================

  /**
   * GET /api/public/receipts/:receiptId/proof
   * 
   * Returns a compact, machine-verifiable proof pack containing:
   * - Canonical hash and integrity proofs
   * - Signature verification result with key governance snapshot
   * - Chain verification status
   * 
   * CRITICAL CONTRACT:
   * - NO transcript content
   * - NO LLM observations  
   * - NO research data
   * - ONLY integrity proofs
   */
  app.get("/api/public/receipts/:receiptId/proof", rateLimitPublic, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        const errorResponse = createPublicError(
          PUBLIC_ERROR_CODES.RECEIPT_NOT_FOUND,
          "Receipt not found",
          { receipt_id: receiptId }
        );
        return res.status(404).json(errorResponse);
      }

      const proofPack = await buildProofPack(receipt);
      res.json(proofPack);
    } catch (error) {
      console.error("Proof pack error:", error);
      const errorResponse = createPublicError(
        PUBLIC_ERROR_CODES.INTERNAL_ERROR,
        "Internal server error"
      );
      res.status(500).json(errorResponse);
    }
  });

  app.get("/api/proofpack/:receiptId", rateLimitPublic, async (req, res) => {
    try {
      const { receiptId } = req.params;
      const receipt = await storage.getReceipt(receiptId as string);
      
      if (!receipt) {
        const errorResponse = createPublicError(
          PUBLIC_ERROR_CODES.RECEIPT_NOT_FOUND,
          "Receipt not found",
          { receipt_id: receiptId }
        );
        return res.status(404).json(errorResponse);
      }

      const proofPack = await buildProofPack(receipt);
      res.json(proofPack);
    } catch (error) {
      console.error("ProofPack error:", error);
      const errorResponse = createPublicError(
        PUBLIC_ERROR_CODES.INTERNAL_ERROR,
        "Internal server error"
      );
      res.status(500).json(errorResponse);
    }
  });

  // ==========================================================================
  // P5: RESEARCH DATASET EXPORT ENDPOINT
  // ==========================================================================

  /**
   * GET /api/research/export
   * 
   * Export anonymized research records for research/analysis.
   * Auth required, rate limited.
   * 
   * Query params:
   * - start_date: YYYY-MM-DD
   * - end_date: YYYY-MM-DD
   * - platform_category: openai|anthropic|google|meta|mistral|cohere|other|unknown
   * - verification_outcome: VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED
   */
  app.get("/api/research/export", requireAuth, async (req, res) => {
    try {
      const filters = {
        startDate: req.query.start_date as string | undefined,
        endDate: req.query.end_date as string | undefined,
        platformCategory: req.query.platform_category as string | undefined,
        verificationOutcome: req.query.verification_outcome as string | undefined,
      };

      const records = await storage.getResearchRecords(filters);

      // Transform DB rows to export format (aligned with researchRecordSchema)
      const exportRecords = records.map(r => {
        const consentData = JSON.parse(r.consentScope);
        return {
          schema: "research-record/1.0" as const,
          research_id: r.researchId,
          capture_date_bucket: r.captureDateBucket,
          verification_date_bucket: r.verificationDateBucket,
          platform_category: r.platformCategory,
          verification_outcome: r.verificationOutcome,
          signature_outcome: r.signatureOutcome,
          chain_outcome: r.chainOutcome,
          structural_stats: JSON.parse(r.structuralStats),
          anomaly_indicators: JSON.parse(r.anomalyIndicators),
          risk_categories: JSON.parse(r.riskCategories),
          pii_presence: JSON.parse(r.piiPresence),
          kill_switch_engaged: r.killSwitchEngaged === 1,
          interpretation_count: bucketToCount(r.interpretationBucket),
          research_consent: consentData,
        };
      });

      // Calculate summary statistics
      const verified = records.filter(r => r.verificationOutcome === "VERIFIED").length;
      const partiallyVerified = records.filter(r => r.verificationOutcome === "PARTIALLY_VERIFIED").length;
      const unverified = records.filter(r => r.verificationOutcome === "UNVERIFIED").length;

      const platformCounts: Record<string, number> = {};
      records.forEach(r => {
        platformCounts[r.platformCategory] = (platformCounts[r.platformCategory] || 0) + 1;
      });

      const withAnomalies = records.filter(r => {
        const indicators = JSON.parse(r.anomalyIndicators);
        return indicators.has_timestamp_issues || 
               indicators.has_structural_anomalies || 
               indicators.has_high_entropy_blocks ||
               indicators.has_pii_indicators ||
               indicators.has_risk_keywords;
      }).length;

      const withPii = records.filter(r => {
        const pii = JSON.parse(r.piiPresence);
        return pii.any_pii_detected;
      }).length;

      const withKillSwitch = records.filter(r => r.killSwitchEngaged === 1).length;

      // Get date range
      const dates = records.map(r => r.captureDateBucket).sort();
      const earliestBucket = dates[0] || "";
      const latestBucket = dates[dates.length - 1] || "";

      logMilestone(
        "RESEARCH_EXPORT_GENERATED",
        `Research dataset exported: ${records.length} records`,
        []
      );

      const exportResult = {
        schema: RESEARCH_SCHEMA_VERSION,
        export_version: "1.0.0",
        export_id: randomUUID(),
        exported_at: new Date().toISOString(),
        record_count: records.length,
        date_range: {
          earliest_bucket: earliestBucket,
          latest_bucket: latestBucket,
        },
        summary: {
          verification_distribution: {
            verified_count: verified,
            partially_verified_count: partiallyVerified,
            unverified_count: unverified,
          },
          platform_distribution: platformCounts,
          anomaly_rate: records.length > 0 ? withAnomalies / records.length : 0,
          pii_detection_rate: records.length > 0 ? withPii / records.length : 0,
          kill_switch_rate: records.length > 0 ? withKillSwitch / records.length : 0,
        },
        // Explicit exclusions declaration (always emitted)
        exclusions: {
          raw_transcripts: true,
          receipt_ids: true,
          ip_addresses: true,
          user_identifiers: true,
          exact_timestamps: true,
          raw_signatures: true,
          public_key_values: true,
          pii_values: true,
          keyword_instances: true,
        },
        records: exportRecords,
      };

      res.json(exportResult);
    } catch (error) {
      console.error("Research export error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ── Saved Views ──

  app.get("/api/saved-views", requireAuth, async (_req: Request, res: Response) => {
    try {
      const views = await storage.listSavedViews();
      res.json({ items: views.map(v => ({ ...v, filters: JSON.parse(v.filtersJson) })) });
    } catch (error) {
      console.error("List saved views error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/saved-views", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = createSavedViewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: fromError(parsed.error).message });
        return;
      }

      const { name, description, filters } = parsed.data;

      const normalizedFilters = {
        ...filters,
        q: filters.q?.trim() || null,
      };

      const existing = await storage.getSavedViewByName(name);
      if (existing) {
        res.status(409).json({ error: "NAME_EXISTS" });
        return;
      }

      const now = new Date().toISOString();
      const viewId = randomUUID();
      const view = await storage.createSavedView({
        id: viewId,
        name,
        description: description ?? null,
        filtersJson: JSON.stringify(normalizedFilters),
        createdAt: now,
        updatedAt: now,
      });

      await logAudit("SAVED_VIEW_CREATED", { savedViewId: viewId, payload: { name, filters: normalizedFilters }, req });

      res.status(201).json({ ...view, filters: JSON.parse(view.filtersJson) });
    } catch (error) {
      console.error("Create saved view error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/saved-views/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = updateSavedViewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: fromError(parsed.error).message });
        return;
      }

      const existing = await storage.getSavedView(id as string);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

      if (parsed.data.name !== undefined) {
        const dup = await storage.getSavedViewByName(parsed.data.name);
        if (dup && dup.id !== id) {
          res.status(409).json({ error: "NAME_EXISTS" });
          return;
        }
        updates.name = parsed.data.name;
      }

      if (parsed.data.description !== undefined) {
        updates.description = parsed.data.description;
      }

      if (parsed.data.filters !== undefined) {
        const normalizedFilters = {
          ...parsed.data.filters,
          q: parsed.data.filters.q?.trim() || null,
        };
        updates.filtersJson = JSON.stringify(normalizedFilters);
      }

      const updated = await storage.updateSavedView(id as string, updates as any);
      if (!updated) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.json({ ...updated, filters: JSON.parse(updated.filtersJson) });
    } catch (error) {
      console.error("Update saved view error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/saved-views/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const existing = await storage.getSavedView(id as string);
      const deleted = await storage.deleteSavedView(id as string);
      if (!deleted) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await logAudit("SAVED_VIEW_DELETED", { savedViewId: id as string, payload: { name: existing?.name }, req });
      res.status(204).send();
    } catch (error) {
      console.error("Delete saved view error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==========================================================================
  // AUDIT TRAIL ENDPOINTS
  // ==========================================================================

  app.get("/api/audit", requireAuth, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Math.min(1000, parseInt(req.query.page as string) || 1));
      const rawSize = parseInt(req.query.pageSize as string) || 50;
      const pageSize = [50, 100, 200].includes(rawSize) ? rawSize : 50;
      const action = (req.query.action as string) || undefined;
      const receiptId = (req.query.receiptId as string) || undefined;
      const exportId = (req.query.exportId as string) || undefined;
      const savedViewId = (req.query.savedViewId as string) || undefined;

      const result = await storage.getAuditEventsPaged({ page, pageSize, action, receiptId, exportId, savedViewId });
      res.json(result);
    } catch (error) {
      console.error("Audit list error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/saved-views/:id/apply", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const view = await storage.getSavedView(id as string);
      if (!view) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await logAudit("SAVED_VIEW_APPLIED", {
        savedViewId: id as string,
        payload: { name: view.name, filters: JSON.parse(view.filtersJson) },
        req,
      });
      res.status(204).send();
    } catch (error) {
      console.error("Apply saved view error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/audit/verify", requireAuth, rateLimitVerify, async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const limit = Math.max(1, Math.min(50000, parseInt(req.query.limit as string) || 5000));
      const strict = req.query.strict === "true";
      const fromSeq = req.query.fromSeq ? Math.max(1, parseInt(req.query.fromSeq as string) || 1) : undefined;
      const toSeq = req.query.toSeq ? Math.max(1, parseInt(req.query.toSeq as string) || Infinity) : undefined;
      const result = await storage.verifyAuditChain(limit, strict, fromSeq, toSeq);
      const ms = Date.now() - start;
      logAuditVerifyResult(result.status, result.checked, result.totalEvents);
      logVerifyLatency(ms, result.ok, result.partial, result.checkedEvents, result.totalEvents, result.firstBadSeq);
      res.json(result);
    } catch (error) {
      console.error("Audit verify error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/compare/viewed", requireAuth, async (req: Request, res: Response) => {
    try {
      const { left, right } = req.body ?? {};
      if (!left || !right || typeof left !== "string" || typeof right !== "string" || left.length > 256 || right.length > 256) {
        res.status(400).json({ error: "Both left and right receipt IDs required (max 256 chars)" });
        return;
      }
      await logAudit("COMPARE_VIEWED", { payload: { left, right }, req });
      res.status(204).send();
    } catch (error) {
      console.error("Compare viewed error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/audit/checkpoints", requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
      const checkpoints = await storage.getCheckpoints(limit);
      res.json({
        checkpoints: checkpoints.map(cp => ({
          id: cp.id,
          seq: cp.seq,
          hash: cp.hash,
          ts: cp.ts,
          prevCheckpointId: cp.prevCheckpointId,
          signatureAlg: cp.signatureAlg,
          publicKeyId: cp.publicKeyId,
          signature: cp.signature,
          eventCount: cp.eventCount,
        })),
        count: checkpoints.length,
      });
    } catch (error) {
      console.error("Checkpoints list error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/audit/checkpoints/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const { verifyCheckpointSignature, getPublicKeyPem } = await import("./checkpoint-signer");
      const checkpoints = await storage.getCheckpoints(1000);
      if (checkpoints.length === 0) {
        res.json({
          ok: true,
          status: "EMPTY",
          checked: 0,
          message: "No checkpoints to verify",
        });
        return;
      }

      const sorted = [...checkpoints].sort((a, b) => a.seq - b.seq);
      const publicKeyPem = getPublicKeyPem();
      let checked = 0;

      for (const cp of sorted) {
        const sigValid = verifyCheckpointSignature(
          cp.signedPayload,
          cp.signature,
          publicKeyPem,
        );

        if (!sigValid) {
          res.json({
            ok: false,
            status: "SIGNATURE_INVALID",
            checked,
            failedCheckpointId: cp.id,
            failedSeq: cp.seq,
            message: `Checkpoint signature verification failed at seq ${cp.seq}`,
          });
          return;
        }
        checked++;
      }

      res.json({
        ok: true,
        status: "VERIFIED",
        checked,
        latestCheckpointSeq: sorted[sorted.length - 1].seq,
        publicKeyId: sorted[0].publicKeyId,
        message: `All ${checked} checkpoint signatures verified`,
      });
    } catch (error) {
      console.error("Checkpoint verify error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/audit/checkpoints/public-key", requireAuth, async (_req: Request, res: Response) => {
    try {
      const { getPublicKeyPem, getOrCreateCheckpointKey } = await import("./checkpoint-signer");
      const keyInfo = getOrCreateCheckpointKey();
      res.json({
        publicKeyId: keyInfo.publicKeyId,
        publicKeyPem: keyInfo.publicKeyPem,
        algorithm: "Ed25519",
      });
    } catch (error) {
      console.error("Public key error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==========================================================================
  // PROOF SPINE: LANTERN FOLLOWUP (proof-gated)
  // ==========================================================================

  app.post("/api/lantern/followup", rateLimitPublic, inputHardening, async (req, res) => {
    try {
      const parseResult = lanternFollowupSchema.safeParse(req.body);
      if (!parseResult.success) {
        const validationError = fromError(parseResult.error);
        return apiError(res, 400, "Invalid request", validationError.message);
      }

      const { receiptId, userText } = parseResult.data;
      let { threadId } = parseResult.data;

      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return apiError(res, 404, "Receipt not found");
      }

      const proofPack = await buildProofPack(receipt);

      if (proofPack.verification_status !== "VERIFIED") {
        return res.status(403).json({
          status: "blocked",
          reason: "Proof not VERIFIED",
          verification_status: proofPack.verification_status,
          integrity: proofPack.integrity,
          signature: { status: proofPack.signature.status },
          chain: { status: proofPack.chain.status },
        });
      }

      if (proofPack.kill_switch_engaged) {
        return res.status(403).json({
          status: "blocked",
          reason: "Kill switch engaged on this receipt",
        });
      }

      let thread = threadId ? await storage.getThread(threadId) : undefined;
      if (!thread) {
        threadId = randomUUID();
        thread = await storage.createThread({
          threadId,
          receiptId,
          proofpackJson: JSON.stringify(proofPack),
          createdAt: new Date().toISOString(),
        });
      }

      const userMessageId = randomUUID();
      await storage.createThreadMessage({
        id: userMessageId,
        threadId: thread.threadId,
        role: "user",
        content: userText,
        createdAt: new Date().toISOString(),
      });

      const assistantContent = `[Lantern stub] Receipt ${receiptId} is VERIFIED. Your question has been recorded. LLM integration pending.`;
      const assistantMessageId = randomUUID();
      await storage.createThreadMessage({
        id: assistantMessageId,
        threadId: thread.threadId,
        role: "assistant",
        content: assistantContent,
        createdAt: new Date().toISOString(),
      });

      await logAudit("lantern.followup", {
        receiptId,
        payload: { threadId: thread.threadId, messageCount: 2 },
        req,
      });

      const messages = await storage.getThreadMessages(thread.threadId);

      res.json({
        status: "ok",
        threadId: thread.threadId,
        receiptId,
        verification_status: proofPack.verification_status,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      console.error("Lantern followup error:", error);
      apiError(res, 500, "Internal server error");
    }
  });

  app.get("/api/lantern/threads/:receiptId", rateLimitPublic, async (req, res) => {
    try {
      const receiptId = req.params.receiptId as string;
      const threadList = await storage.getThreadsByReceipt(receiptId);
      res.json({
        threads: threadList.map(t => ({
          threadId: t.threadId,
          receiptId: t.receiptId,
          createdAt: t.createdAt,
        })),
      });
    } catch (error) {
      console.error("Lantern threads error:", error);
      apiError(res, 500, "Internal server error");
    }
  });

  app.get("/api/lantern/thread/:threadId/messages", rateLimitPublic, async (req, res) => {
    try {
      const threadId = req.params.threadId as string;
      const thread = await storage.getThread(threadId);
      if (!thread) {
        return apiError(res, 404, "Thread not found");
      }
      const messages = await storage.getThreadMessages(threadId);
      res.json({
        threadId,
        receiptId: thread.receiptId,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      console.error("Lantern messages error:", error);
      apiError(res, 500, "Internal server error");
    }
  });

  app.use("/api", (req, res, next) => {
    if (!res.headersSent) {
      apiError(res, 404, "Not found", `No route matches ${req.method} ${req.originalUrl}`);
    }
  });

  return httpServer;
}
