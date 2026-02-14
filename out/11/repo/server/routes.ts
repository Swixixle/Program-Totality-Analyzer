import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCaseSchema, insertUploadSchema, ingestionStateEnum, extractionJobStateEnum, claimSchema, anchorSchema, corpusPurposeEnum, sourceRoleEnum, buildModeEnum, type Anchor, type AnchorRecord } from "@shared/schema";
import { generateVerifiedRecord, generateVerifiedRecordPDF } from "./verifiedRecordGenerator";
import { z } from "zod";
import { createHash } from "crypto";

const MOCK_ANCHORS: Record<string, Anchor> = {
  "anchor-001": {
    id: "anchor-001",
    quote: "This Agreement is entered into as of March 15, 2024, by and between Party A and Party B.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 1",
    section_ref: "§1.1 Parties",
    timeline_date: "2024-03-15"
  },
  "anchor-002": {
    id: "anchor-002",
    quote: "Both parties hereby acknowledge receipt of this executed agreement and agree to be bound by its terms.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 12",
    section_ref: "Signature Block",
    timeline_date: "2024-03-15"
  },
  "anchor-003": {
    id: "anchor-003",
    quote: "Payment shall be due within thirty (30) days of invoice date. Late payments shall accrue interest at 1.5% per month.",
    source_document: "Master Services Agreement v2.1.pdf",
    page_ref: "p. 5",
    section_ref: "§4.2 Payment Terms",
    timeline_date: "2024-03-15"
  },
  "anchor-004": {
    id: "anchor-004",
    quote: "Payment terms are hereby amended to net forty-five (45) days from invoice date.",
    source_document: "Amendment A.pdf",
    page_ref: "p. 1",
    section_ref: "§1 Payment Terms Amendment",
    timeline_date: "2024-06-01"
  }
};

function canonicalizeForHash(corpusId: string, claims: z.infer<typeof claimSchema>[]) {
  const sortedClaims = [...claims].map(c => ({
    ...c,
    anchor_ids: [...c.anchor_ids].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ corpus_id: corpusId, claims: sortedClaims });
}

function computeSnapshotHash(corpusId: string, claims: z.infer<typeof claimSchema>[]) {
  const canonical = canonicalizeForHash(corpusId, claims);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join, extname } from "path";
import multer from "multer";
import PDFParser from "pdf2json";
import { startJobProcessor } from "./extractionProcessor";
import archiver from "archiver";
import AdmZip from "adm-zip";
import { verifyBundle, ZipReader, ZipEntry } from "@shared/bundleVerify";
import { extractPdfPages, extractAnchorsWithProvenance, readPdfFromPath } from "./pdfProcessor";

const isDev = process.env.NODE_ENV !== "production";

const UPLOADS_DIR = join(process.cwd(), "uploads");

// Sentence-window extraction (2-4 sentences per anchor)
// This is a deterministic extraction rule with no relevance scoring
interface ExtractedAnchor {
  quote: string;
  pageRef: string;
  sectionRef?: string;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function extractAnchorsFromSource(source: { filename: string }): ExtractedAnchor[] {
  // For v1.2, we generate deterministic mock anchors from the filename
  // In production, this would parse actual file content
  // The extraction rule is sentence-window with 2-4 sentences
  
  const anchors: ExtractedAnchor[] = [];
  
  // Generate deterministic anchors based on filename hash
  const filenameHash = createHash("sha256").update(source.filename).digest("hex");
  const anchorCount = 2 + (parseInt(filenameHash.slice(0, 2), 16) % 4); // 2-5 anchors
  
  for (let i = 0; i < anchorCount; i++) {
    const pageNum = 1 + (parseInt(filenameHash.slice(i * 2, i * 2 + 2), 16) % 10);
    anchors.push({
      quote: `[Verbatim text extracted from ${source.filename}, anchor ${i + 1}]`,
      pageRef: `p. ${pageNum}`,
      sectionRef: i % 2 === 0 ? `§${i + 1}` : undefined
    });
  }
  
  return anchors;
}

async function ensureUploadsDir() {
  try {
    await mkdir(UPLOADS_DIR, { recursive: true });
  } catch (e) {
  }
}

const ALLOWED_TEXT_EXTENSIONS = [".txt", ".md"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PDF_SIZE = 10 * 1024 * 1024;
const MIN_TEXT_LENGTH = 50;

const textUploadStorage = multer.memoryStorage();

const textUpload = multer({
  storage: textUploadStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext === ".pdf") {
      cb(new Error("USE_PDF_ENDPOINT"));
      return;
    }
    if (!ALLOWED_TEXT_EXTENSIONS.includes(ext)) {
      cb(new Error("UNSUPPORTED_TYPE"));
      return;
    }
    cb(null, true);
  }
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext !== ".pdf") {
      cb(new Error("NOT_A_PDF"));
      return;
    }
    cb(null, true);
  }
});

const bundleUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ext !== ".zip") {
      cb(new Error("NOT_A_ZIP"));
      return;
    }
    cb(null, true);
  }
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.LANTERN_API_KEY;
  if (!apiKey) {
    return res.status(401).json({ type: "AUTH_ERROR", message: "Unauthorized" });
  }
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ type: "AUTH_ERROR", message: "Unauthorized" });
  }
  
  const token = authHeader.slice(7);
  if (token !== apiKey) {
    return res.status(401).json({ type: "AUTH_ERROR", message: "Unauthorized" });
  }
  
  next();
}

function optionalAuthForPublicReadonly(req: Request, res: Response, next: NextFunction) {
  const publicReadonly = process.env.LANTERN_PUBLIC_READONLY === "true";
  if (publicReadonly) {
    return next();
  }
  return requireAuth(req, res, next);
}

function computeSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function seedDemoCorpusIfMissing() {
  const DEMO_CORPUS_ID = "corpus-demo-001";
  const FIXTURE_FILENAME = "demo.pdf";
  const FIXTURE_PATH = join(process.cwd(), "client/public/fixtures", FIXTURE_FILENAME);
  
  const existing = await storage.getCorpus(DEMO_CORPUS_ID);
  if (existing) {
    console.log("[DemoSeeder] Demo corpus already exists, skipping seed");
    return;
  }
  
  console.log("[DemoSeeder] Creating demo corpus...");
  
  try {
    const pdfBuffer = await readFile(FIXTURE_PATH);
    const sha256Hex = createHash("sha256").update(pdfBuffer).digest("hex");
    
    await storage.createCorpusWithId({
      id: DEMO_CORPUS_ID,
      purpose: "CLAIM_GOVERNANCE"
    });
    
    const corpusDir = join(UPLOADS_DIR, "corpus", DEMO_CORPUS_ID);
    await mkdir(corpusDir, { recursive: true });
    const storagePath = join(corpusDir, `${sha256Hex}-${FIXTURE_FILENAME}`);
    await writeFile(storagePath, pdfBuffer);
    
    const source = await storage.createCorpusSource({
      corpusId: DEMO_CORPUS_ID,
      role: "PRIMARY",
      filename: FIXTURE_FILENAME,
      sha256Hex,
      storagePath: `/uploads/corpus/${DEMO_CORPUS_ID}/${sha256Hex}-${FIXTURE_FILENAME}`
    });
    
    await storage.createLedgerEvent(
      DEMO_CORPUS_ID,
      "SOURCE_UPLOADED",
      "SOURCE",
      source.id,
      { source_id: source.id, filename: FIXTURE_FILENAME, sha256_hex: sha256Hex }
    );
    
    console.log(`[DemoSeeder] Created demo corpus with source ${source.id}`);
    
    const { extractPdfPages } = await import("./pdfProcessor");
    const pages = await extractPdfPages(pdfBuffer, source.id);
    
    for (const page of pages) {
      await storage.createPdfPage({
        sourceId: source.id,
        pageIndex: page.pageIndex,
        pageText: page.pageText,
        pageTextSha256Hex: page.pageTextSha256Hex,
        pagePngPath: page.pagePngPath
      });
    }
    
    const sha256Hex_pages = createHash("sha256").update(pdfBuffer).digest("hex");
    const anchorsWithProvenance = extractAnchorsWithProvenance(
      pages,
      sha256Hex_pages,
      source.id
    );
    
    for (const anchor of anchorsWithProvenance) {
      await storage.createAnchorRecord({
        corpusId: DEMO_CORPUS_ID,
        sourceId: source.id,
        quote: anchor.quote,
        sourceDocument: FIXTURE_FILENAME,
        pageRef: anchor.pageRef,
        sectionRef: anchor.sectionRef,
        timelineDate: new Date().toISOString().slice(0, 10),
        provenanceJson: JSON.stringify(anchor.provenance)
      });
    }
    
    await storage.createLedgerEvent(
      DEMO_CORPUS_ID,
      "BUILD_RUN",
      "SOURCE",
      source.id,
      { source_id: source.id, pages_extracted: pages.length, anchors_extracted: anchorsWithProvenance.length }
    );
    
    console.log(`[DemoSeeder] PDF processed successfully with ${pages.length} pages and ${anchorsWithProvenance.length} anchors`);
    
  } catch (err) {
    console.error("[DemoSeeder] Failed to seed demo corpus:", err);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await ensureUploadsDir();
  await seedDemoCorpusIfMissing();
  
  app.get("/__boot", (_req, res) => {
    if (!isDev) {
      return res.status(404).send("Not Found");
    }
    const timestamp = new Date().toISOString();
    const html = `<!DOCTYPE html>
<html>
<head><title>Boot Test</title></head>
<body style="background:#111;color:#0f0;font-family:monospace;padding:40px;">
  <h1 style="font-size:48px;margin-bottom:20px;">BOOT OK</h1>
  <p>Timestamp: ${timestamp}</p>
  <p>PID: ${process.pid}</p>
  <p>Server is responding correctly.</p>
  <hr style="border-color:#333;margin:20px 0;">
  <p><a href="/" style="color:#0ff;font-size:18px;">Open App →</a></p>
  <p><a href="/__health" style="color:#0ff;">Check Health JSON</a></p>
</body>
</html>`;
    res.type("html").send(html);
  });

  app.get("/__health", (_req, res) => {
    if (!isDev) {
      return res.status(404).send("Not Found");
    }
    res.json({
      ok: true,
      time: new Date().toISOString(),
      pid: process.pid,
      env: process.env.NODE_ENV || "development"
    });
  });

  // v1.9 Auth status endpoint
  app.get("/api/auth/status", requireAuth, (_req, res) => {
    res.json({ authenticated: true });
  });

  app.get("/api/auth/demo-key", (_req, res) => {
    const demoKey = process.env.LANTERN_API_KEY;
    if (demoKey) {
      res.json({ key: demoKey });
    } else {
      res.status(404).json({ message: "Demo key not available" });
    }
  });

  // v1.11 Config endpoint (public, no auth)
  app.get("/api/config", (_req, res) => {
    res.json({ public_readonly: process.env.LANTERN_PUBLIC_READONLY === "true" });
  });

  // v1.23 Public Review Bundle Download (read-only, no auth when public_readonly=true)
  app.get("/api/review/:corpusId/bundle", asyncHandler(async (req, res) => {
    const isPublicReadOnly = process.env.LANTERN_PUBLIC_READONLY === "true";
    
    if (!isPublicReadOnly) {
      return res.status(401).json({
        type: "AUTH_ERROR",
        message: "Unauthorized"
      });
    }
    
    if (req.query.deterministic !== "true") {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "deterministic=true required"
      });
    }
    
    const corpusId = req.params.corpusId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const ledgerEvents = await storage.listLedgerEvents(corpusId, { limit: 501 });
    if (ledgerEvents.length > 500) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Ledger exceeds export limit; increase limit support before exporting."
      });
    }
    
    const sources = await storage.listCorpusSources(corpusId);
    const snapshotsList = await storage.listSnapshotsByCorpus(corpusId);
    const packetsList = await storage.listEvidencePacketsByCorpus(corpusId);
    
    const bundleDir = `lantern-corpus-${corpusId}`;
    const files: { path: string; sha256_hex: string }[] = [];
    
    const corpusJson = JSON.stringify({
      corpus_id: corpus.id,
      created_at: corpus.createdAt,
      purpose: corpus.purpose
    });
    
    const sourcesJson = JSON.stringify({
      corpus_id: corpusId,
      sources: sources.map(s => ({
        source_id: s.id,
        corpus_id: s.corpusId,
        role: s.role,
        filename: s.filename,
        uploaded_at: s.uploadedAt,
        sha256_hex: s.sha256Hex
      }))
    });
    
    const ledgerJson = JSON.stringify({
      corpus_id: corpusId,
      events: ledgerEvents.map(e => ({
        event_id: e.id,
        occurred_at: e.occurredAt.toISOString(),
        corpus_id: e.corpusId,
        event_type: e.eventType,
        entity: {
          entity_type: e.entityType,
          entity_id: e.entityId
        },
        payload: JSON.parse(e.payloadJson),
        hash_alg: e.hashAlg,
        hash_hex: e.hashHex
      }))
    });
    
    files.push({ path: "corpus.json", sha256_hex: createHash("sha256").update(corpusJson).digest("hex") });
    files.push({ path: "ledger.json", sha256_hex: createHash("sha256").update(ledgerJson).digest("hex") });
    files.push({ path: "sources.json", sha256_hex: createHash("sha256").update(sourcesJson).digest("hex") });
    
    const snapshotContents: { id: string; json: string }[] = [];
    for (const snap of snapshotsList) {
      const snapData = JSON.parse(snap.snapshotJson);
      const snapScope = snap.snapshotScopeJson ? JSON.parse(snap.snapshotScopeJson) : null;
      const snapJson = JSON.stringify({
        snapshot_id: snap.id,
        created_at: snap.createdAt,
        corpus_id: snap.corpusId,
        hash_alg: snap.hashAlg,
        hash_hex: snap.hashHex,
        claims: snapData.claims,
        snapshot_scope: snapScope
      });
      snapshotContents.push({ id: snap.id, json: snapJson });
      files.push({ path: `snapshots/${snap.id}.json`, sha256_hex: createHash("sha256").update(snapJson).digest("hex") });
    }
    
    const packetContents: { id: string; json: string }[] = [];
    for (const pkt of packetsList) {
      const pktJson = JSON.stringify({
        packet_id: pkt.id,
        created_at: pkt.createdAt,
        ...JSON.parse(pkt.packetJson)
      });
      packetContents.push({ id: pkt.id, json: pktJson });
      files.push({ path: `packets/${pkt.id}.json`, sha256_hex: createHash("sha256").update(pktJson).digest("hex") });
    }
    
    const pageProofContents: { sourceId: string; pageIndex: number; json: string }[] = [];
    for (const src of sources) {
      const pdfPages = await storage.listPdfPagesBySource(src.id);
      for (const page of pdfPages) {
        const pageJsonData = {
          source_id: src.id,
          page_index: page.pageIndex,
          page_text_sha256_hex: page.pageTextSha256Hex
        };
        const pageJson = JSON.stringify(pageJsonData);
        pageProofContents.push({
          sourceId: src.id,
          pageIndex: page.pageIndex,
          json: pageJson
        });
        files.push({ path: `pages/${src.id}/page-${page.pageIndex}.json`, sha256_hex: createHash("sha256").update(pageJson).digest("hex") });
      }
    }
    
    const allAnchors = await storage.listAnchorRecordsByCorpus(corpusId);
    const pdfJsAnchors = allAnchors.filter(a => {
      if (!a.provenanceJson) return false;
      try {
        const prov = JSON.parse(a.provenanceJson);
        return prov.extractor?.name === "pdfjs-text-v1";
      } catch { return false; }
    });
    
    const pageTextHashMap = new Map<string, string>();
    for (const pageProof of pageProofContents) {
      const parsed = JSON.parse(pageProof.json);
      const key = `${pageProof.sourceId}:${pageProof.pageIndex}`;
      pageTextHashMap.set(key, parsed.page_text_sha256_hex);
    }
    
    const anchorsProofEntries = pdfJsAnchors.map(a => {
      const prov = JSON.parse(a.provenanceJson!);
      const key = `${prov.source_id}:${prov.page_index}`;
      return {
        anchor_id: a.id,
        source_id: prov.source_id,
        page_index: prov.page_index,
        quote_start_char: prov.quote_start_char,
        quote_end_char: prov.quote_end_char,
        page_text_sha256_hex: pageTextHashMap.get(key) || ""
      };
    }).sort((a, b) => a.anchor_id.localeCompare(b.anchor_id));
    
    const anchorsProofIndex = {
      corpus_id: corpusId,
      extractor: { name: "pdfjs-text-v1", version: "1.0.0" },
      anchors: anchorsProofEntries
    };
    const anchorsProofIndexJson = JSON.stringify(anchorsProofIndex);
    files.push({ path: "anchors_proof_index.json", sha256_hex: createHash("sha256").update(anchorsProofIndexJson).digest("hex") });
    
    const claimsList = await storage.listClaimRecordsByCorpus(corpusId);
    
    const sourcesByRole: Record<string, number> = {};
    for (const src of sources) {
      sourcesByRole[src.role] = (sourcesByRole[src.role] || 0) + 1;
    }
    const sortedSourcesByRole: Record<string, number> = {};
    for (const key of Object.keys(sourcesByRole).sort()) {
      sortedSourcesByRole[key] = sourcesByRole[key];
    }
    
    const anchorsBySourceId: Record<string, number> = {};
    for (const anchor of allAnchors) {
      anchorsBySourceId[anchor.sourceId] = (anchorsBySourceId[anchor.sourceId] || 0) + 1;
    }
    const sortedAnchorsBySourceId: Record<string, number> = {};
    for (const key of Object.keys(anchorsBySourceId).sort()) {
      sortedAnchorsBySourceId[key] = anchorsBySourceId[key];
    }
    
    const claimsByClassification: Record<string, number> = {
      "AMBIGUOUS": 0,
      "DEFENSIBLE": 0,
      "RESTRICTED": 0
    };
    for (const claim of claimsList) {
      if (claim.classification && claimsByClassification.hasOwnProperty(claim.classification)) {
        claimsByClassification[claim.classification]++;
      }
    }
    
    const ledgerByType: Record<string, number> = {
      "BUILD_RUN": 0,
      "CLAIM_CREATED": 0,
      "CLAIM_DELETED": 0,
      "CORPUS_CREATED": 0,
      "PACKET_CREATED": 0,
      "SNAPSHOT_CREATED": 0,
      "SOURCE_UPLOADED": 0
    };
    for (const evt of ledgerEvents) {
      if (ledgerByType.hasOwnProperty(evt.eventType)) {
        ledgerByType[evt.eventType]++;
      }
    }
    
    const auditSummary = {
      corpus_id: corpusId,
      sources: {
        count: sources.length,
        by_role: sortedSourcesByRole
      },
      pages: {
        count: pageProofContents.length
      },
      anchors: {
        count: allAnchors.length,
        by_source_id: sortedAnchorsBySourceId
      },
      claims: {
        count: claimsList.length,
        by_classification: claimsByClassification
      },
      snapshots: {
        count: snapshotsList.length
      },
      packets: {
        count: packetsList.length
      },
      ledger_events: {
        count: ledgerEvents.length,
        by_type: ledgerByType
      }
    };
    const auditSummaryJson = JSON.stringify(auditSummary);
    files.push({ path: "audit_summary.json", sha256_hex: createHash("sha256").update(auditSummaryJson).digest("hex") });
    
    const packetProofEntries = packetsList.map(pkt => ({
      packet_id: pkt.id,
      claim_id: pkt.claimId,
      snapshot_id: pkt.snapshotId,
      snapshot_hash_hex: pkt.snapshotHashHex,
      packet_hash_hex: pkt.hashHex
    })).sort((a, b) => a.packet_id.localeCompare(b.packet_id));
    
    const packetProofIndex = {
      corpus_id: corpusId,
      packets: packetProofEntries
    };
    const packetProofIndexJson = JSON.stringify(packetProofIndex);
    files.push({ path: "packet_proof_index.json", sha256_hex: createHash("sha256").update(packetProofIndexJson).digest("hex") });
    
    const snapshotProofEntries = snapshotsList.map(snap => ({
      snapshot_id: snap.id,
      created_at: snap.createdAt,
      hash_alg: snap.hashAlg,
      hash_hex: snap.hashHex
    })).sort((a, b) => a.snapshot_id.localeCompare(b.snapshot_id));
    
    const snapshotProofIndex = {
      corpus_id: corpusId,
      snapshots: snapshotProofEntries
    };
    const snapshotProofIndexJson = JSON.stringify(snapshotProofIndex);
    files.push({ path: "snapshot_proof_index.json", sha256_hex: createHash("sha256").update(snapshotProofIndexJson).digest("hex") });
    
    const ledgerProofEntries = ledgerEvents.map(e => ({
      event_id: e.id,
      occurred_at: e.occurredAt.toISOString(),
      event_type: e.eventType,
      entity_type: e.entityType,
      entity_id: e.entityId,
      hash_alg: e.hashAlg,
      hash_hex: e.hashHex
    })).sort((a, b) => a.event_id.localeCompare(b.event_id));
    
    const ledgerProofIndex = {
      corpus_id: corpusId,
      events: ledgerProofEntries
    };
    const ledgerProofIndexJson = JSON.stringify(ledgerProofIndex);
    files.push({ path: "ledger_proof_index.json", sha256_hex: createHash("sha256").update(ledgerProofIndexJson).digest("hex") });
    
    // v1.29: Generate audit_lines.txt
    const auditLines: string[] = [];
    for (const entry of anchorsProofEntries) {
      const pdfPage = await storage.getPdfPage(entry.source_id, entry.page_index);
      if (!pdfPage) continue;
      const substring = pdfPage.pageText.slice(entry.quote_start_char, entry.quote_end_char);
      const substringSha256Hex = createHash("sha256").update(substring, "utf8").digest("hex");
      auditLines.push(`${entry.anchor_id}|${entry.source_id}|${entry.page_index}|${entry.quote_start_char}|${entry.quote_end_char}|${pdfPage.pageTextSha256Hex}|${substringSha256Hex}`);
    }
    auditLines.sort((a, b) => a.localeCompare(b));
    const auditLinesTxt = auditLines.join("\n") + "\n";
    files.push({ path: "audit_lines.txt", sha256_hex: createHash("sha256").update(auditLinesTxt).digest("hex") });
    
    files.sort((a, b) => a.path.localeCompare(b.path));
    
    const manifestWithoutHash = {
      bundle_format: "lantern-corpus-bundle-v1",
      corpus_id: corpusId,
      include_raw_sources: false,
      files: files,
      manifest_hash_alg: "SHA-256"
    };
    const manifestCanonical = JSON.stringify(manifestWithoutHash);
    const manifestHash = createHash("sha256").update(manifestCanonical).digest("hex");
    
    const manifest = {
      ...manifestWithoutHash,
      manifest_hash_hex: manifestHash
    };
    const manifestJson = JSON.stringify(manifest);
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="lantern-corpus-${corpusId}.zip"`);
    
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);
    
    archive.append(manifestJson, { name: `${bundleDir}/MANIFEST.json` });
    archive.append(corpusJson, { name: `${bundleDir}/corpus.json` });
    archive.append(ledgerJson, { name: `${bundleDir}/ledger.json` });
    archive.append(sourcesJson, { name: `${bundleDir}/sources.json` });
    
    for (const snap of snapshotContents) {
      archive.append(snap.json, { name: `${bundleDir}/snapshots/${snap.id}.json` });
    }
    
    for (const pkt of packetContents) {
      archive.append(pkt.json, { name: `${bundleDir}/packets/${pkt.id}.json` });
    }
    
    for (const pg of pageProofContents) {
      archive.append(pg.json, { name: `${bundleDir}/pages/${pg.sourceId}/page-${pg.pageIndex}.json` });
    }
    
    archive.append(anchorsProofIndexJson, { name: `${bundleDir}/anchors_proof_index.json` });
    archive.append(auditSummaryJson, { name: `${bundleDir}/audit_summary.json` });
    archive.append(packetProofIndexJson, { name: `${bundleDir}/packet_proof_index.json` });
    archive.append(snapshotProofIndexJson, { name: `${bundleDir}/snapshot_proof_index.json` });
    archive.append(ledgerProofIndexJson, { name: `${bundleDir}/ledger_proof_index.json` });
    archive.append(auditLinesTxt, { name: `${bundleDir}/audit_lines.txt` });
    
    await archive.finalize();
  }));

  // v1.28 Audit Lines endpoint
  app.get("/api/review/:corpusId/audit_lines", asyncHandler(async (req, res) => {
    const isPublicReadOnly = process.env.LANTERN_PUBLIC_READONLY === "true";
    
    if (!isPublicReadOnly) {
      return res.status(401).json({
        type: "AUTH_ERROR",
        message: "Unauthorized"
      });
    }
    
    const corpusId = req.params.corpusId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const anchors = await storage.listAnchorRecordsByCorpusFiltered(corpusId);
    
    // Filter to only anchors with provenance.extractor.name === "pdfjs-text-v1"
    const eligibleAnchors = anchors.filter(a => {
      if (!a.provenanceJson) return false;
      try {
        const prov = JSON.parse(a.provenanceJson);
        return prov.extractor?.name === "pdfjs-text-v1";
      } catch { return false; }
    });
    
    const lines: string[] = [];
    
    for (const anchor of eligibleAnchors) {
      const prov = JSON.parse(anchor.provenanceJson!);
      const sourceId = prov.source_id;
      const pageIndex = prov.page_index;
      const quoteStartChar = prov.quote_start_char;
      const quoteEndChar = prov.quote_end_char;
      
      // Get page text hash
      const pdfPage = await storage.getPdfPage(sourceId, pageIndex);
      if (!pdfPage) continue;
      
      const pageTextSha256Hex = pdfPage.pageTextSha256Hex;
      
      // Compute substring sha256
      const substring = pdfPage.pageText.slice(quoteStartChar, quoteEndChar);
      const substringSha256Hex = createHash("sha256").update(substring, "utf8").digest("hex");
      
      lines.push(`${anchor.id}|${sourceId}|${pageIndex}|${quoteStartChar}|${quoteEndChar}|${pageTextSha256Hex}|${substringSha256Hex}`);
    }
    
    // Sort by anchor_id lexicographically
    lines.sort((a, b) => a.localeCompare(b));
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(lines.join("\n") + "\n");
  }));

  app.post("/api/upload", (req, res, next) => {
    textUpload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.message === "USE_PDF_ENDPOINT") {
          return res.status(415).json({
            type: "USE_PDF_ENDPOINT",
            message: "For PDF files, use POST /api/upload/pdf instead.",
            redirect: "/api/upload/pdf"
          });
        }
        if (err.message === "UNSUPPORTED_TYPE") {
          return res.status(415).json({
            type: "UNSUPPORTED_MEDIA_TYPE",
            message: "Unsupported file type. Only .txt and .md files are supported.",
            supported_types: ALLOWED_TEXT_EXTENSIONS
          });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            type: "FILE_TOO_LARGE",
            message: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
          });
        }
        return next(err);
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          type: "VALIDATION_ERROR",
          message: "No file provided. Include a file in the 'file' field."
        });
      }
      
      const text = file.buffer.toString("utf-8");
      
      res.json({
        filename: file.originalname,
        text,
        size: file.size,
        mimeType: file.mimetype
      });
    });
  });

  app.post("/api/upload/pdf", (req, res, next) => {
    pdfUpload.single("file")(req, res, async (err: any) => {
      if (err) {
        if (err.message === "NOT_A_PDF") {
          return res.status(415).json({
            type: "UNSUPPORTED_MEDIA_TYPE",
            error: "NOT_A_PDF",
            code: 415,
            message: "Only PDF files are accepted at this endpoint."
          });
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            type: "FILE_TOO_LARGE",
            error: "FILE_TOO_LARGE",
            code: 413,
            message: `File exceeds maximum size of ${MAX_PDF_SIZE / 1024 / 1024}MB`
          });
        }
        return next(err);
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          type: "VALIDATION_ERROR",
          error: "NO_FILE",
          code: 400,
          message: "No file provided. Include a PDF file in the 'file' field."
        });
      }
      
      try {
        const pdfParser = new PDFParser(null, true);
        
        const parseResult = await new Promise<{ text: string; pages: number }>((resolve, reject) => {
          pdfParser.on("pdfParser_dataError", (errData: any) => {
            reject(new Error(errData.parserError || "PDF parsing failed"));
          });
          
          pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const pages = pdfData.Pages || [];
            let text = "";
            
            for (const page of pages) {
              const texts = page.Texts || [];
              for (const textItem of texts) {
                const runs = textItem.R || [];
                for (const run of runs) {
                  if (run.T) {
                    text += decodeURIComponent(run.T) + " ";
                  }
                }
              }
              text += "\n";
            }
            
            resolve({ text: text.trim(), pages: pages.length });
          });
          
          pdfParser.parseBuffer(file.buffer);
        });
        
        const text = parseResult.text;
        
        if (text.length < MIN_TEXT_LENGTH) {
          return res.status(422).json({
            type: "UNPROCESSABLE_ENTITY",
            error: "IMAGE_BASED_PDF",
            code: 422,
            message: "PDF appears image-based; OCR not implemented yet. Please use a text-based PDF or paste the content manually.",
            charCount: text.length
          });
        }
        
        console.log(`[PDF Upload] Extracted ${text.length} chars from ${file.originalname}`);
        
        res.json({
          filename: file.originalname,
          text,
          pages: parseResult.pages,
          charCount: text.length
        });
      } catch (parseError: any) {
        console.error("[PDF Upload] Parse error:", parseError.message);
        return res.status(422).json({
          type: "PARSE_ERROR",
          error: "PDF_PARSE_FAILED",
          code: 422,
          message: "Failed to extract text from PDF. The file may be corrupted or password-protected."
        });
      }
    });
  });

  app.post("/api/cases", asyncHandler(async (req, res) => {
    const parsed = insertCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        type: "VALIDATION_ERROR",
        errors: parsed.error.errors 
      });
    }
    
    if (!parsed.data.name || parsed.data.name.trim() === "") {
      return res.status(400).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: ["name"],
        next_actions: ["Provide a case name"]
      });
    }
    
    const newCase = await storage.createCase(parsed.data);
    res.status(201).json(newCase);
  }));

  app.get("/api/cases", asyncHandler(async (_req, res) => {
    const allCases = await storage.listCases();
    res.json(allCases);
  }));

  app.get("/api/cases/:caseId", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const caseData = await storage.getCase(caseId);
    
    if (!caseData) {
      return res.status(404).json({ 
        type: "NOT_FOUND",
        message: "Case not found" 
      });
    }
    
    res.json(caseData);
  }));

  app.patch("/api/cases/:caseId", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const existing = await storage.getCase(caseId);
    
    if (!existing) {
      return res.status(404).json({ 
        type: "NOT_FOUND",
        message: "Case not found" 
      });
    }
    
    if (existing.status === "sealed") {
      return res.status(403).json({
        type: "SEALED",
        message: "Cannot modify a sealed case"
      });
    }
    
    const allowedFields = ["name", "status", "decisionTarget", "decisionTime"];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in req.body) {
        updateData[field] = req.body[field];
      }
    }
    
    const updated = await storage.updateCase(caseId, updateData);
    res.json(updated);
  }));

  app.delete("/api/cases/:caseId", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const success = await storage.archiveCase(caseId);
    
    if (!success) {
      return res.status(404).json({ 
        type: "NOT_FOUND",
        message: "Case not found" 
      });
    }
    
    res.json({ archived: true });
  }));

  app.post("/api/cases/:caseId/uploads/init", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    
    const caseData = await storage.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: ["valid caseId"],
        next_actions: ["Select or create a case first"]
      });
    }
    
    if (caseData.status === "sealed") {
      return res.status(403).json({
        type: "SEALED",
        message: "Cannot upload to a sealed case"
      });
    }
    
    const { filename, mimeType, evidenceType, sourceLabel } = req.body;
    
    if (!filename || !mimeType) {
      return res.status(400).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: [!filename ? "filename" : null, !mimeType ? "mimeType" : null].filter(Boolean),
        next_actions: ["Provide filename and mimeType"]
      });
    }
    
    const validEvidenceTypes = ["document", "photo", "scan", "note", "other"];
    const finalEvidenceType = validEvidenceTypes.includes(evidenceType) ? evidenceType : "document";
    
    const upload = await storage.createUpload({
      caseId,
      filename,
      mimeType,
      evidenceType: finalEvidenceType,
      sourceLabel: sourceLabel || null,
      ingestionState: "uploaded"
    });
    
    res.status(201).json({
      uploadId: upload.id,
      uploadUrl: `/api/cases/${caseId}/uploads/${upload.id}/data`,
      method: "PUT"
    });
  }));

  app.put("/api/cases/:caseId/uploads/:uploadId/data", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const uploadId = req.params.uploadId as string;
    
    const upload = await storage.getUpload(uploadId);
    if (!upload || upload.caseId !== caseId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Upload not found"
      });
    }
    
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    const sha256 = computeSha256(buffer);
    const storagePath = join(UPLOADS_DIR, `${uploadId}_${upload.filename}`);
    
    await writeFile(storagePath, buffer);
    
    await storage.updateUpload(uploadId, {
      sha256,
      storagePath,
      fileSize: buffer.length,
      ingestionState: "stored"
    });
    
    const updated = await storage.getUpload(uploadId);
    res.json(updated);
  }));

  app.post("/api/cases/:caseId/uploads/complete", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const { uploadId } = req.body;
    
    if (!uploadId) {
      return res.status(400).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: ["uploadId"],
        next_actions: ["Provide the uploadId from init"]
      });
    }
    
    const upload = await storage.getUpload(uploadId);
    if (!upload || upload.caseId !== caseId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Upload not found"
      });
    }
    
    if (upload.ingestionState !== "stored") {
      return res.status(400).json({
        type: "INVALID_STATE",
        message: `Upload is in state '${upload.ingestionState}', expected 'stored'`
      });
    }
    
    await storage.updateUploadState(uploadId, "extracted");
    
    const updated = await storage.getUpload(uploadId);
    res.json({
      upload: updated,
      message: "Upload complete, ingestion started"
    });
  }));

  app.get("/api/cases/:caseId/uploads", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    
    const caseData = await storage.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: ["valid caseId"],
        next_actions: ["Select or create a case first"]
      });
    }
    
    const uploadsList = await storage.listUploadsForCase(caseId);
    res.json(uploadsList);
  }));

  app.get("/api/cases/:caseId/uploads/:uploadId", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const uploadId = req.params.uploadId as string;
    
    const upload = await storage.getUpload(uploadId);
    if (!upload || upload.caseId !== caseId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Upload not found"
      });
    }
    
    res.json(upload);
  }));

  app.patch("/api/cases/:caseId/uploads/:uploadId/state", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    const uploadId = req.params.uploadId as string;
    const { state } = req.body;
    
    const validStates = ingestionStateEnum.options;
    if (!validStates.includes(state)) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: `Invalid state. Must be one of: ${validStates.join(", ")}`
      });
    }
    
    const upload = await storage.getUpload(uploadId);
    if (!upload || upload.caseId !== caseId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Upload not found"
      });
    }
    
    const updated = await storage.updateUploadState(uploadId, state);
    res.json(updated);
  }));

  app.get("/api/cases/:caseId/chunks", asyncHandler(async (req, res) => {
    const caseId = req.params.caseId as string;
    
    const caseData = await storage.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({
        type: "CONTEXT_REQUIRED",
        missing_fields: ["valid caseId"],
        next_actions: ["Select or create a case first"]
      });
    }
    
    const chunksList = await storage.listChunksForCase(caseId);
    res.json(chunksList);
  }));

  // === EXTRACTION JOB API ===
  
  // Create a new extraction job
  app.post("/api/extract", asyncHandler(async (req, res) => {
    const { sourceText, metadata, options } = req.body;
    
    if (!sourceText || typeof sourceText !== "string") {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "sourceText is required and must be a string"
      });
    }
    
    if (sourceText.length < 50) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "sourceText must be at least 50 characters"
      });
    }
    
    const job = await storage.createExtractionJob({
      sourceText,
      metadata: JSON.stringify(metadata || {}),
      options: options ? JSON.stringify(options) : null,
      state: "queued",
      progress: 0
    });
    
    console.log(`[Extract API] Created job ${job.id} for ${sourceText.length} chars`);
    
    res.status(201).json({
      job_id: job.id,
      state: job.state,
      progress: job.progress,
      created_at: job.createdAt
    });
  }));
  
  // Get job status
  app.get("/api/jobs/:jobId", asyncHandler(async (req, res) => {
    const jobId = req.params.jobId as string;
    const job = await storage.getExtractionJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Job not found"
      });
    }
    
    const response: any = {
      job_id: job.id,
      state: job.state,
      progress: job.progress,
      created_at: job.createdAt,
      updated_at: job.updatedAt
    };
    
    if (job.state === "complete") {
      response.pack_id = job.packId;
      response.pack = job.packData ? JSON.parse(job.packData) : null;
      response.completed_at = job.completedAt;
    }
    
    if (job.state === "failed") {
      response.error_code = job.errorCode;
      response.error_message = job.errorMessage;
      response.completed_at = job.completedAt;
    }
    
    res.json(response);
  }));

  // === CORPUS API ===
  
  const corpusUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }
  });
  
  // List all corpora
  app.get("/api/corpora", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corporaList = await storage.listCorpora();
    res.json({
      corpora: corporaList.map(c => ({
        corpus_id: c.id,
        purpose: c.purpose,
        created_at: c.createdAt
      }))
    });
  }));
  
  // Create corpus
  app.post("/api/corpus", requireAuth, asyncHandler(async (req, res) => {
    const { purpose } = req.body;
    
    const parseResult = corpusPurposeEnum.safeParse(purpose);
    if (!parseResult.success) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid purpose. Must be one of: Litigation support, Investigative journalism, Compliance/Internal Review, Research/Exploratory"
      });
    }
    
    const corpus = await storage.createCorpus({ purpose: parseResult.data });
    
    await storage.createLedgerEvent(
      corpus.id,
      "CORPUS_CREATED",
      "CORPUS",
      corpus.id,
      { purpose: parseResult.data }
    );
    
    res.status(201).json({
      corpus_id: corpus.id,
      created_at: corpus.createdAt,
      purpose: corpus.purpose
    });
  }));
  
  // Upload source into corpus
  app.post("/api/corpus/:corpusId/sources", requireAuth, corpusUpload.single("file"), asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const role = String(req.body.role || "");
    const file = req.file;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const roleResult = sourceRoleEnum.safeParse(role);
    if (!roleResult.success) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid role. Must be PRIMARY or SECONDARY"
      });
    }
    
    if (!file) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "File is required"
      });
    }
    
    const sha256Hex = createHash("sha256").update(file.buffer).digest("hex");
    
    const corpusDir = join(UPLOADS_DIR, "corpus", corpusId);
    await mkdir(corpusDir, { recursive: true });
    const storagePath = join("corpus", corpusId, `${sha256Hex}-${file.originalname}`);
    const fullPath = join(UPLOADS_DIR, storagePath);
    await writeFile(fullPath, file.buffer);
    
    const source = await storage.createCorpusSource({
      corpusId,
      role: roleResult.data,
      filename: file.originalname,
      sha256Hex,
      storagePath
    });
    
    await storage.createLedgerEvent(
      corpusId,
      "SOURCE_UPLOADED",
      "SOURCE",
      source.id,
      {
        source_id: source.id,
        role: roleResult.data,
        filename: file.originalname,
        sha256_hex: sha256Hex
      }
    );
    
    res.status(201).json({
      source_id: source.id,
      corpus_id: source.corpusId,
      role: source.role,
      filename: source.filename,
      uploaded_at: source.uploadedAt,
      sha256_hex: source.sha256Hex
    });
  }));
  
  // List corpus sources
  app.get("/api/corpus/:corpusId/sources", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const sources = await storage.listCorpusSources(corpusId);
    
    res.json({
      corpus_id: corpusId,
      sources: sources.map(s => ({
        source_id: s.id,
        corpus_id: s.corpusId,
        role: s.role,
        filename: s.filename,
        uploaded_at: s.uploadedAt,
        sha256_hex: s.sha256Hex
      }))
    });
  }));

  // Build corpus artifacts (extraction pipeline)
  // Extraction Rule: Sentence-window (2-4 sentences)
  // Timeline Date: Upload timestamp (not inferred from content)
  app.post("/api/corpus/:corpusId/build", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const { mode } = req.body;
    
    const modeResult = buildModeEnum.safeParse(mode);
    if (!modeResult.success) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid mode. Must be 'anchors_only' or 'claims_from_anchors'"
      });
    }
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const sources = await storage.listCorpusSources(corpusId);
    if (sources.length === 0) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "No sources in corpus. Upload sources before building."
      });
    }
    
    let anchorsCreated = 0;
    const claimsCreated = 0;
    const constraintsCreated = 0;
    let pagesIndexed = 0;
    let pagesRendered = 0;
    
    if (modeResult.data === "anchors_only") {
      for (const source of sources) {
        const isPdf = source.filename.toLowerCase().endsWith(".pdf");
        
        if (isPdf && source.storagePath) {
          try {
            const pdfPath = join(UPLOADS_DIR, source.storagePath);
            const pdfBuffer = await readPdfFromPath(pdfPath);
            
            const extractedPages = await extractPdfPages(pdfBuffer, source.id);
            pagesIndexed += extractedPages.length;
            pagesRendered += extractedPages.length;
            
            for (const page of extractedPages) {
              await storage.createPdfPage({
                sourceId: source.id,
                pageIndex: page.pageIndex,
                pageText: page.pageText,
                pagePngPath: page.pagePngPath,
                pageTextSha256Hex: page.pageTextSha256Hex
              });
            }
            
            const anchorsWithProvenance = extractAnchorsWithProvenance(
              extractedPages,
              source.id,
              source.sha256Hex
            );
            
            for (const anchor of anchorsWithProvenance) {
              await storage.createAnchorRecord({
                corpusId,
                sourceId: source.id,
                quote: anchor.quote,
                sourceDocument: source.filename,
                pageRef: anchor.pageRef,
                sectionRef: anchor.sectionRef || null,
                timelineDate: source.uploadedAt.toISOString().split("T")[0],
                provenanceJson: JSON.stringify(anchor.provenance)
              });
              anchorsCreated++;
            }
          } catch (err) {
            console.error(`Error processing PDF ${source.filename}:`, err);
            const fallbackAnchors = extractAnchorsFromSource(source);
            for (const anchor of fallbackAnchors) {
              await storage.createAnchorRecord({
                corpusId,
                sourceId: source.id,
                quote: anchor.quote,
                sourceDocument: source.filename,
                pageRef: anchor.pageRef,
                sectionRef: anchor.sectionRef || null,
                timelineDate: source.uploadedAt.toISOString().split("T")[0],
                provenanceJson: null
              });
              anchorsCreated++;
            }
          }
        } else {
          const fallbackAnchors = extractAnchorsFromSource(source);
          for (const anchor of fallbackAnchors) {
            await storage.createAnchorRecord({
              corpusId,
              sourceId: source.id,
              quote: anchor.quote,
              sourceDocument: source.filename,
              pageRef: anchor.pageRef,
              sectionRef: anchor.sectionRef || null,
              timelineDate: source.uploadedAt.toISOString().split("T")[0],
              provenanceJson: null
            });
            anchorsCreated++;
          }
        }
      }
    }
    
    const buildId = `build-${Date.now()}`;
    await storage.createLedgerEvent(
      corpusId,
      "BUILD_RUN",
      "BUILD",
      buildId,
      {
        mode: modeResult.data,
        status: "COMPLETED",
        pages_indexed: pagesIndexed,
        pages_rendered: pagesRendered,
        anchors_created: anchorsCreated,
        claims_created: claimsCreated,
        constraints_created: constraintsCreated
      }
    );
    
    res.status(201).json({
      corpus_id: corpusId,
      mode: modeResult.data,
      status: "COMPLETED",
      pages_indexed: pagesIndexed,
      pages_rendered: pagesRendered,
      anchors_created: anchorsCreated,
      claims_created: claimsCreated,
      constraints_created: constraintsCreated
    });
  }));

  // === CLAIMS API ===
  
  const MOCK_CLAIMS = [
    {
      id: "claim-def-001",
      classification: "DEFENSIBLE",
      text: "The contract was executed on March 15, 2024.",
      confidence: 0.92,
      refusal_reason: null,
      anchor_ids: ["anchor-001"]
    },
    {
      id: "claim-def-002",
      classification: "DEFENSIBLE",
      text: "Payment terms are net-30 from invoice date.",
      confidence: 0.87,
      refusal_reason: null,
      anchor_ids: ["anchor-002", "anchor-003"]
    },
    {
      id: "claim-res-001",
      classification: "RESTRICTED",
      text: "The vendor has a history of late deliveries.",
      confidence: 0.45,
      refusal_reason: "No documentary evidence in corpus supports this claim. Only primary sources dated after 2024-01-01 were reviewed.",
      anchor_ids: []
    },
    {
      id: "claim-res-002",
      classification: "RESTRICTED",
      text: "The regulatory environment is likely to become more favorable.",
      confidence: 0.30,
      refusal_reason: "Speculative claim about future events. Corpus contains no predictive analysis or forward-looking statements.",
      anchor_ids: []
    },
    {
      id: "claim-amb-001",
      classification: "AMBIGUOUS",
      text: "The agreement includes standard indemnification provisions.",
      confidence: 0.65,
      refusal_reason: null,
      anchor_ids: ["anchor-001"]
    }
  ];
  
  app.get("/api/claims", asyncHandler(async (req, res) => {
    const corpusId = (req.query.corpusId as string) || "corpus-demo-001";
    
    res.json({
      corpus_id: corpusId,
      claims: MOCK_CLAIMS
    });
  }));

  // === ANCHOR API ===
  
  app.get("/api/anchors", asyncHandler(async (req, res) => {
    const idsParam = req.query.ids as string;
    const corpusId = (req.query.corpusId as string) || "corpus-demo-001";
    
    if (!idsParam) {
      return res.json({ corpus_id: corpusId, anchors: [], missing_ids: [] });
    }
    
    const requestedIds = idsParam.split(",").map(id => id.trim()).filter(Boolean);
    const anchors: Anchor[] = [];
    const missing_ids: string[] = [];
    
    for (const id of requestedIds) {
      if (MOCK_ANCHORS[id]) {
        anchors.push(MOCK_ANCHORS[id]);
      } else {
        missing_ids.push(id);
      }
    }
    
    res.json({ corpus_id: corpusId, anchors, missing_ids });
  }));

  // List anchor records by corpus (with optional filters)
  app.get("/api/corpus/:corpusId/anchors", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const role = req.query.role as string | undefined;
    const sourceId = req.query.source_id as string | undefined;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const anchorRecords = await storage.listAnchorRecordsByCorpusFiltered(corpusId, role, sourceId);
    
    res.json({
      corpus_id: corpusId,
      anchors: anchorRecords.map(a => ({
        id: a.id,
        corpus_id: a.corpusId,
        source_id: a.sourceId,
        quote: a.quote,
        source_document: a.sourceDocument,
        page_ref: a.pageRef,
        section_ref: a.sectionRef,
        timeline_date: a.timelineDate,
        provenance: a.provenanceJson ? JSON.parse(a.provenanceJson) : null
      }))
    });
  }));

  // === PDF PAGE PROOF API ===
  
  // Get PDF page proof (image + text hash)
  app.get("/api/sources/:sourceId/pages/:pageIndex", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const sourceId = req.params.sourceId as string;
    const pageIndex = parseInt(req.params.pageIndex as string, 10);
    const includeText = req.query.include_text === "true";
    
    if (isNaN(pageIndex) || pageIndex < 0) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid page_index. Must be a non-negative integer."
      });
    }
    
    const source = await storage.getCorpusSource(sourceId);
    if (!source) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Source not found"
      });
    }
    
    const page = await storage.getPdfPage(sourceId, pageIndex);
    if (!page) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Page not found"
      });
    }
    
    const response: Record<string, any> = {
      source_id: sourceId,
      page_index: pageIndex,
      page_text_sha256_hex: page.pageTextSha256Hex,
      page_png_url: page.pagePngPath
    };
    
    if (includeText) {
      response.page_text = page.pageText;
    }
    
    res.json(response);
  }));

  // === ANCHOR PROOF API ===
  
  // Get anchor proof packet (single anchor)
  app.get("/api/anchors/:anchorId/proof", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const anchorId = req.params.anchorId as string;
    
    const anchor = await storage.getAnchorRecord(anchorId);
    if (!anchor) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Anchor not found"
      });
    }
    
    if (!anchor.provenanceJson) {
      return res.status(400).json({
        type: "PROOF_UNAVAILABLE",
        message: "This anchor does not have provenance data. It may have been created before v1.13 or from a non-PDF source."
      });
    }
    
    const provenance = JSON.parse(anchor.provenanceJson);
    
    const page = await storage.getPdfPage(anchor.sourceId, provenance.page_index);
    if (!page) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Page data not found for this anchor"
      });
    }
    
    const substringFromPage = page.pageText.slice(provenance.quote_start_char, provenance.quote_end_char);
    const substringHash = createHash("sha256").update(substringFromPage, "utf8").digest("hex");
    
    res.json({
      anchor: {
        id: anchor.id,
        corpus_id: anchor.corpusId,
        source_id: anchor.sourceId,
        quote: anchor.quote,
        source_document: anchor.sourceDocument,
        page_ref: anchor.pageRef,
        section_ref: anchor.sectionRef,
        timeline_date: anchor.timelineDate,
        provenance
      },
      page: {
        source_id: anchor.sourceId,
        page_index: provenance.page_index,
        page_text_sha256_hex: page.pageTextSha256Hex,
        page_png_url: page.pagePngPath
      },
      repro: {
        page_text_substring: substringFromPage,
        substring_sha256_hex: substringHash
      }
    });
  }));

  // === CLAIM RECORDS API ===
  
  // Create claim (user-authored)
  app.post("/api/corpus/:corpusId/claims", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const { text, anchor_ids } = req.body;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "text is required and must be a non-empty string"
      });
    }
    
    const anchorIds = Array.isArray(anchor_ids) ? anchor_ids : [];
    
    let classification: "DEFENSIBLE" | "RESTRICTED";
    let confidence: number;
    let refusalReason: string | null;
    
    if (anchorIds.length >= 1) {
      classification = "DEFENSIBLE";
      confidence = 0.75;
      refusalReason = null;
    } else {
      classification = "RESTRICTED";
      confidence = 0.60;
      refusalReason = "No anchors attached; claim is not defensible in current corpus.";
    }
    
    const claimRecord = await storage.createClaimRecord({
      corpusId,
      classification,
      text: text.trim(),
      confidence,
      refusalReason,
      anchorIds
    });
    
    await storage.createLedgerEvent(
      corpusId,
      "CLAIM_CREATED",
      "CLAIM",
      claimRecord.id,
      {
        claim_id: claimRecord.id,
        classification: claimRecord.classification,
        anchor_count: anchorIds.length
      }
    );
    
    res.status(201).json({
      id: claimRecord.id,
      corpus_id: claimRecord.corpusId,
      classification: claimRecord.classification,
      text: claimRecord.text,
      confidence: claimRecord.confidence,
      refusal_reason: claimRecord.refusalReason,
      anchor_ids: claimRecord.anchorIds,
      created_at: claimRecord.createdAt
    });
  }));
  
  // List claims (corpus-scoped)
  app.get("/api/corpus/:corpusId/claims", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const claimRecords = await storage.listClaimRecordsByCorpus(corpusId);
    
    res.json({
      corpus_id: corpusId,
      claims: claimRecords.map(c => ({
        id: c.id,
        corpus_id: c.corpusId,
        classification: c.classification,
        text: c.text,
        confidence: c.confidence,
        refusal_reason: c.refusalReason,
        anchor_ids: c.anchorIds,
        created_at: c.createdAt
      }))
    });
  }));
  
  // Delete claim
  app.delete("/api/corpus/:corpusId/claims/:claimId", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const claimId = req.params.claimId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const claim = await storage.getClaimRecord(claimId);
    if (!claim || claim.corpusId !== corpusId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Claim not found"
      });
    }
    
    await storage.deleteClaimRecord(claimId);
    
    await storage.createLedgerEvent(
      corpusId,
      "CLAIM_DELETED",
      "CLAIM",
      claimId,
      { claim_id: claimId }
    );
    
    res.status(204).send();
  }));

  // === EVIDENCE PACKETS API ===
  
  function canonicalizePacketForHash(payload: {
    corpus_id: string;
    snapshot_id?: string;
    snapshot_hash_hex?: string;
    claim: {
      id: string;
      classification: string;
      text: string;
      confidence: number;
      anchor_ids: string[];
    };
    anchors: {
      id: string;
      quote: string;
      source_document: string;
      page_ref: string;
      section_ref?: string | null;
      timeline_date: string;
      source_id: string;
    }[];
  }) {
    const sortedClaim = {
      ...payload.claim,
      anchor_ids: [...payload.claim.anchor_ids].sort()
    };
    const sortedAnchors = [...payload.anchors].sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ 
      corpus_id: payload.corpus_id, 
      snapshot_id: payload.snapshot_id,
      snapshot_hash_hex: payload.snapshot_hash_hex,
      claim: sortedClaim, 
      anchors: sortedAnchors 
    });
  }

  function computePacketHash(payload: Parameters<typeof canonicalizePacketForHash>[0]) {
    const canonical = canonicalizePacketForHash(payload);
    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  // Create evidence packet (requires snapshot_id)
  app.post("/api/corpus/:corpusId/claims/:claimId/packet", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const claimId = req.params.claimId as string;
    const { snapshot_id } = req.body;
    
    if (!snapshot_id || typeof snapshot_id !== "string") {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "snapshot_id is required"
      });
    }
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const snapshot = await storage.getSnapshot(snapshot_id);
    if (!snapshot) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Snapshot not found"
      });
    }
    
    if (snapshot.corpusId !== corpusId) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Snapshot does not belong to this corpus"
      });
    }
    
    const claim = await storage.getClaimRecord(claimId);
    if (!claim || claim.corpusId !== corpusId) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Claim not found"
      });
    }
    
    if (claim.classification !== "DEFENSIBLE" || claim.anchorIds.length === 0) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Evidence packet requires a DEFENSIBLE claim with at least one anchor."
      });
    }
    
    const snapshotScope = snapshot.snapshotScopeJson ? JSON.parse(snapshot.snapshotScopeJson) : null;
    if (snapshotScope) {
      const includesClaimIds: string[] = snapshotScope.includes_claim_ids || [];
      if (!includesClaimIds.includes(claimId)) {
        return res.status(400).json({
          type: "VALIDATION_ERROR",
          message: "Claim is not included in snapshot scope"
        });
      }
    }
    
    const anchors = await storage.getAnchorRecordsByIds(claim.anchorIds);
    
    const hashablePayload = {
      corpus_id: corpusId,
      snapshot_id: snapshot_id,
      snapshot_hash_hex: snapshot.hashHex,
      claim: {
        id: claim.id,
        classification: claim.classification as "DEFENSIBLE",
        text: claim.text,
        confidence: claim.confidence,
        anchor_ids: claim.anchorIds
      },
      anchors: anchors.map(a => ({
        id: a.id,
        quote: a.quote,
        source_document: a.sourceDocument,
        page_ref: a.pageRef,
        section_ref: a.sectionRef,
        timeline_date: a.timelineDate,
        source_id: a.sourceId
      }))
    };
    
    const hashHex = computePacketHash(hashablePayload);
    
    const packetJson = JSON.stringify({
      corpus_id: corpusId,
      snapshot_id: snapshot_id,
      snapshot_hash_hex: snapshot.hashHex,
      claim: hashablePayload.claim,
      anchors: hashablePayload.anchors,
      hash_alg: "SHA-256",
      hash_hex: hashHex
    });
    
    const packet = await storage.createEvidencePacket({
      corpusId,
      claimId,
      snapshotId: snapshot_id,
      snapshotHashHex: snapshot.hashHex,
      packetJson,
      hashAlg: "SHA-256",
      hashHex
    });
    
    await storage.createLedgerEvent(
      corpusId,
      "PACKET_CREATED",
      "PACKET",
      packet.id,
      {
        packet_id: packet.id,
        claim_id: claimId,
        snapshot_id: snapshot_id,
        hash_hex: hashHex
      }
    );
    
    const responsePacket = {
      packet_id: packet.id,
      created_at: packet.createdAt,
      ...JSON.parse(packet.packetJson)
    };
    
    res.status(201).json(responsePacket);
  }));
  
  // Export evidence packet as printable text format (must come before :packetId route)
  app.get("/api/packets/:packetId.pdf", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const packetId = req.params.packetId as string;
    
    const packet = await storage.getEvidencePacket(packetId);
    if (!packet) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Packet not found"
      });
    }
    
    const storedData = JSON.parse(packet.packetJson);
    
    const lines: string[] = [];
    const hr = "═".repeat(80);
    const thinHr = "─".repeat(80);
    
    lines.push(hr);
    lines.push("LANTERN EVIDENCE PACKET");
    lines.push(hr);
    lines.push("");
    lines.push(`Packet ID: ${packet.id}`);
    lines.push(`Created: ${packet.createdAt.toISOString()}`);
    lines.push(`Corpus ID: ${storedData.corpus_id}`);
    lines.push(`Snapshot ID: ${storedData.snapshot_id}`);
    lines.push(`Snapshot Hash (SHA-256): ${storedData.snapshot_hash_hex}`);
    lines.push(`Packet Hash (SHA-256): ${packet.hashHex}`);
    lines.push("");
    
    lines.push(thinHr);
    lines.push("CLAIM");
    lines.push(thinHr);
    const claim = storedData.claim;
    lines.push(`Claim ID: ${claim.id}`);
    lines.push(`Classification: ${claim.classification}`);
    lines.push(`Confidence: ${Math.round((claim.confidence || 0) * 100)}%`);
    lines.push("");
    lines.push("Text:");
    lines.push(`"${claim.text}"`);
    lines.push("");
    
    lines.push(thinHr);
    lines.push("SUPPORTING ANCHORS");
    lines.push(thinHr);
    
    const anchors = storedData.anchors || [];
    if (anchors.length === 0) {
      lines.push("No anchors attached.");
    } else {
      for (let i = 0; i < anchors.length; i++) {
        const anchor = anchors[i];
        lines.push(`Anchor ${i + 1}:`);
        lines.push(`  ID: ${anchor.id}`);
        lines.push(`  Source: ${anchor.source_document}`);
        lines.push(`  Page: ${anchor.page_ref || "N/A"}`);
        if (anchor.section_ref) {
          lines.push(`  Section: ${anchor.section_ref}`);
        }
        if (anchor.timeline_date) {
          lines.push(`  Date: ${anchor.timeline_date}`);
        }
        lines.push(`  Quote: "${anchor.quote}"`);
        lines.push("");
      }
    }
    
    lines.push(thinHr);
    lines.push("CHAIN OF CUSTODY");
    lines.push(thinHr);
    lines.push("This packet is cryptographically linked to its corpus snapshot.");
    lines.push(`Snapshot Hash: ${storedData.snapshot_hash_hex}`);
    lines.push(`Packet Hash: ${packet.hashHex}`);
    lines.push("");
    lines.push("To verify integrity:");
    lines.push(`  GET /api/packets/${packet.id}/verify`);
    lines.push(`  GET /api/packets/${packet.id}/verify_chain`);
    lines.push("");
    
    lines.push(hr);
    lines.push("END OF EVIDENCE PACKET");
    lines.push(hr);
    
    const textContent = lines.join("\n");
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="packet-${packet.id}.txt"`);
    res.send(textContent);
  }));

  // Get evidence packet
  app.get("/api/packets/:packetId", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const packetId = req.params.packetId as string;
    
    const packet = await storage.getEvidencePacket(packetId);
    if (!packet) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Packet not found"
      });
    }
    
    const responsePacket = {
      packet_id: packet.id,
      created_at: packet.createdAt,
      ...JSON.parse(packet.packetJson)
    };
    
    res.json(responsePacket);
  }));
  
  // Verify evidence packet
  app.get("/api/packets/:packetId/verify", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const packetId = req.params.packetId as string;
    
    const packet = await storage.getEvidencePacket(packetId);
    if (!packet) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Packet not found"
      });
    }
    
    const storedData = JSON.parse(packet.packetJson);
    
    const hashablePayload = {
      corpus_id: storedData.corpus_id,
      snapshot_id: storedData.snapshot_id,
      snapshot_hash_hex: storedData.snapshot_hash_hex,
      claim: storedData.claim,
      anchors: storedData.anchors
    };
    
    const recomputedHashHex = computePacketHash(hashablePayload);
    const verified = recomputedHashHex === packet.hashHex;
    
    res.json({
      packet_id: packet.id,
      verified,
      hash_alg: packet.hashAlg,
      stored_hash_hex: packet.hashHex,
      recomputed_hash_hex: recomputedHashHex
    });
  }));
  
  // Verify evidence packet chain (packet + snapshot linkage)
  app.get("/api/packets/:packetId/verify_chain", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const packetId = req.params.packetId as string;
    
    const packet = await storage.getEvidencePacket(packetId);
    if (!packet) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Packet not found"
      });
    }
    
    const storedData = JSON.parse(packet.packetJson);
    
    const hashablePayload = {
      corpus_id: storedData.corpus_id,
      snapshot_id: storedData.snapshot_id,
      snapshot_hash_hex: storedData.snapshot_hash_hex,
      claim: storedData.claim,
      anchors: storedData.anchors
    };
    
    const recomputedPacketHash = computePacketHash(hashablePayload);
    const verifiedPacketHash = recomputedPacketHash === packet.hashHex;
    
    const snapshot = await storage.getSnapshot(packet.snapshotId);
    let verifiedSnapshotHash = false;
    let snapshotHashMatch = false;
    let claimInSnapshotScope = false;
    let sourcesInSnapshotScope = false;
    
    if (snapshot) {
      const snapshotData = JSON.parse(snapshot.snapshotJson);
      const recomputedSnapshotHash = computeSnapshotHash(snapshot.corpusId, snapshotData.claims || []);
      verifiedSnapshotHash = recomputedSnapshotHash === snapshot.hashHex;
      snapshotHashMatch = packet.snapshotHashHex === snapshot.hashHex;
      
      const snapshotScope = snapshot.snapshotScopeJson ? JSON.parse(snapshot.snapshotScopeJson) : null;
      if (snapshotScope) {
        const includesClaimIds: string[] = snapshotScope.includes_claim_ids || [];
        const includesSourceIds: string[] = snapshotScope.includes_source_ids || [];
        
        claimInSnapshotScope = includesClaimIds.includes(storedData.claim.id);
        
        const anchorSourceIds = storedData.anchors.map((a: { source_id: string }) => a.source_id);
        sourcesInSnapshotScope = anchorSourceIds.every((sid: string) => includesSourceIds.includes(sid));
      } else {
        claimInSnapshotScope = true;
        sourcesInSnapshotScope = true;
      }
    }
    
    res.json({
      packet_id: packet.id,
      verified_packet_hash: verifiedPacketHash,
      verified_snapshot_hash: verifiedSnapshotHash,
      snapshot_id: packet.snapshotId,
      snapshot_hash_match: snapshotHashMatch,
      claim_in_snapshot_scope: claimInSnapshotScope,
      sources_in_snapshot_scope: sourcesInSnapshotScope
    });
  }));

  // === CONSTRAINTS API ===
  
  function parseJsonSafe<T>(jsonStr: string | null): T | null {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }
  
  app.get("/api/constraints", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.query.corpusId as string || "corpus-demo-001";
    
    const dbConstraints = await storage.listConstraintsByCorpus(corpusId);
    
    const constraints = dbConstraints.map(c => ({
      id: c.id,
      type: c.type,
      summary: c.summary,
      claim_id: c.claimId || null,
      anchor_ids: c.anchorIds || [],
      time_context: parseJsonSafe<{ earlier_date?: string; later_date?: string; note: string }>(c.timeContext),
      missing: parseJsonSafe<{ requested_assertion: string; reason: string }>(c.missing),
      conflict: parseJsonSafe<{ left: { anchor_id: string; source_document: string; page_ref: string }; right: { anchor_id: string; source_document: string; page_ref: string } }>(c.conflict)
    }));
    
    res.json({
      corpus_id: corpusId,
      constraints
    });
  }));

  // === SNAPSHOT API ===
  
  // Create snapshot (with snapshot_scope)
  app.post("/api/snapshots", requireAuth, asyncHandler(async (req, res) => {
    const { corpus_id, claims } = req.body;
    
    if (!corpus_id || typeof corpus_id !== "string") {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "corpus_id is required"
      });
    }
    
    const claimsArraySchema = z.array(claimSchema);
    const parseResult = claimsArraySchema.safeParse(claims);
    
    if (!parseResult.success) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid claims format",
        details: parseResult.error.issues
      });
    }
    
    const validClaims = parseResult.data;
    const hashHex = computeSnapshotHash(corpus_id, validClaims);
    
    const snapshotData = {
      corpus_id,
      claims: validClaims
    };
    
    const claimRecords = await storage.listClaimRecordsByCorpus(corpus_id);
    const sources = await storage.listCorpusSources(corpus_id);
    
    const snapshotScope = {
      includes_claim_ids: claimRecords.map(c => c.id).sort(),
      includes_source_ids: sources.map(s => s.id).sort()
    };
    
    const snapshot = await storage.createSnapshot({
      corpusId: corpus_id,
      snapshotJson: JSON.stringify(snapshotData),
      snapshotScopeJson: JSON.stringify(snapshotScope),
      hashAlg: "SHA-256",
      hashHex
    });
    
    await storage.createLedgerEvent(
      corpus_id,
      "SNAPSHOT_CREATED",
      "SNAPSHOT",
      snapshot.id,
      {
        snapshot_id: snapshot.id,
        hash_hex: hashHex
      }
    );
    
    console.log(`[Snapshot API] Created snapshot ${snapshot.id} for corpus ${corpus_id}`);
    
    res.status(201).json({
      snapshot_id: snapshot.id,
      created_at: snapshot.createdAt,
      hash_alg: snapshot.hashAlg,
      hash_hex: snapshot.hashHex,
      snapshot_scope: snapshotScope
    });
  }));
  
  // List snapshots for corpus
  app.get("/api/corpus/:corpusId/snapshots", asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const snapshotsList = await storage.listSnapshotsByCorpus(corpusId);
    
    res.json({
      corpus_id: corpusId,
      snapshots: snapshotsList.map(s => ({
        snapshot_id: s.id,
        created_at: s.createdAt,
        hash_alg: s.hashAlg,
        hash_hex: s.hashHex,
        snapshot_scope: s.snapshotScopeJson ? JSON.parse(s.snapshotScopeJson) : null
      }))
    });
  }));
  
  // Get snapshot
  app.get("/api/snapshots/:snapshotId", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const snapshotId = req.params.snapshotId as string;
    const snapshot = await storage.getSnapshot(snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Snapshot not found"
      });
    }
    
    const snapshotData = JSON.parse(snapshot.snapshotJson);
    
    res.json({
      snapshot_id: snapshot.id,
      created_at: snapshot.createdAt,
      corpus_id: snapshot.corpusId,
      claims: snapshotData.claims,
      hash_alg: snapshot.hashAlg,
      hash_hex: snapshot.hashHex
    });
  }));
  
  // Verify snapshot
  app.get("/api/snapshots/:snapshotId/verify", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const snapshotId = req.params.snapshotId as string;
    const snapshot = await storage.getSnapshot(snapshotId);
    
    if (!snapshot) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Snapshot not found"
      });
    }
    
    const snapshotData = JSON.parse(snapshot.snapshotJson);
    const recomputedHash = computeSnapshotHash(snapshotData.corpus_id, snapshotData.claims);
    const verified = recomputedHash === snapshot.hashHex;
    
    res.json({
      snapshot_id: snapshot.id,
      verified,
      hash_alg: snapshot.hashAlg,
      stored_hash_hex: snapshot.hashHex,
      recomputed_hash_hex: recomputedHash
    });
  }));

  // === LEDGER API ===
  
  // List ledger events for a corpus
  app.get("/api/corpus/:corpusId/ledger", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const limitParam = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const afterParam = req.query.after ? String(req.query.after) : undefined;
    const eventTypeParam = req.query.event_type ? String(req.query.event_type) : undefined;
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const limit = Math.min(Math.max(1, limitParam), 500);
    
    const events = await storage.listLedgerEvents(corpusId, {
      limit,
      after: afterParam,
      event_type: eventTypeParam as any
    });
    
    res.json({
      corpus_id: corpusId,
      events: events.map(e => ({
        event_id: e.id,
        occurred_at: e.occurredAt.toISOString(),
        corpus_id: e.corpusId,
        event_type: e.eventType,
        entity: {
          entity_type: e.entityType,
          entity_id: e.entityId
        },
        payload: JSON.parse(e.payloadJson),
        hash_alg: e.hashAlg,
        hash_hex: e.hashHex
      }))
    });
  }));
  
  // Verify a ledger event
  app.get("/api/ledger/:eventId/verify", asyncHandler(async (req, res) => {
    const eventId = req.params.eventId as string;
    
    const event = await storage.getLedgerEvent(eventId);
    if (!event) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Event not found"
      });
    }
    
    const payload = JSON.parse(event.payloadJson);
    const canonicalObj = {
      corpus_id: event.corpusId,
      event_type: event.eventType,
      entity: { entity_type: event.entityType, entity_id: event.entityId },
      payload: payload
    };
    const canonicalJson = JSON.stringify(canonicalObj);
    const recomputedHashHex = createHash("sha256").update(canonicalJson).digest("hex");
    
    res.json({
      event_id: event.id,
      verified: event.hashHex === recomputedHashHex,
      hash_alg: event.hashAlg,
      stored_hash_hex: event.hashHex,
      recomputed_hash_hex: recomputedHashHex
    });
  }));

  // === EXPORT BUNDLE API ===
  
  app.get("/api/corpus/:corpusId/export_bundle", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const includeRawSources = req.query.include_raw_sources === "true";
    const deterministic = req.query.deterministic === "true";
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const ledgerEvents = await storage.listLedgerEvents(corpusId, { limit: 501 });
    if (ledgerEvents.length > 500) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Ledger exceeds export limit; increase limit support before exporting."
      });
    }
    
    const sources = await storage.listCorpusSources(corpusId);
    const snapshotsList = await storage.listSnapshotsByCorpus(corpusId);
    const packetsList = await storage.listEvidencePacketsByCorpus(corpusId);
    
    const bundleDir = `lantern-corpus-${corpusId}`;
    const files: { path: string; sha256_hex: string }[] = [];
    
    const corpusJson = JSON.stringify({
      corpus_id: corpus.id,
      created_at: corpus.createdAt,
      purpose: corpus.purpose
    });
    
    const sourcesJson = JSON.stringify({
      corpus_id: corpusId,
      sources: sources.map(s => ({
        source_id: s.id,
        corpus_id: s.corpusId,
        role: s.role,
        filename: s.filename,
        uploaded_at: s.uploadedAt,
        sha256_hex: s.sha256Hex
      }))
    });
    
    const ledgerJson = JSON.stringify({
      corpus_id: corpusId,
      events: ledgerEvents.map(e => ({
        event_id: e.id,
        occurred_at: e.occurredAt.toISOString(),
        corpus_id: e.corpusId,
        event_type: e.eventType,
        entity: {
          entity_type: e.entityType,
          entity_id: e.entityId
        },
        payload: JSON.parse(e.payloadJson),
        hash_alg: e.hashAlg,
        hash_hex: e.hashHex
      }))
    });
    
    files.push({ path: "corpus.json", sha256_hex: createHash("sha256").update(corpusJson).digest("hex") });
    files.push({ path: "ledger.json", sha256_hex: createHash("sha256").update(ledgerJson).digest("hex") });
    files.push({ path: "sources.json", sha256_hex: createHash("sha256").update(sourcesJson).digest("hex") });
    
    const snapshotContents: { id: string; json: string }[] = [];
    for (const snap of snapshotsList) {
      const snapData = JSON.parse(snap.snapshotJson);
      const snapScope = snap.snapshotScopeJson ? JSON.parse(snap.snapshotScopeJson) : null;
      const snapJson = JSON.stringify({
        snapshot_id: snap.id,
        created_at: snap.createdAt,
        corpus_id: snap.corpusId,
        hash_alg: snap.hashAlg,
        hash_hex: snap.hashHex,
        claims: snapData.claims,
        snapshot_scope: snapScope
      });
      snapshotContents.push({ id: snap.id, json: snapJson });
      files.push({ path: `snapshots/${snap.id}.json`, sha256_hex: createHash("sha256").update(snapJson).digest("hex") });
    }
    
    const packetContents: { id: string; json: string }[] = [];
    for (const pkt of packetsList) {
      const pktJson = JSON.stringify({
        packet_id: pkt.id,
        created_at: pkt.createdAt,
        ...JSON.parse(pkt.packetJson)
      });
      packetContents.push({ id: pkt.id, json: pktJson });
      files.push({ path: `packets/${pkt.id}.json`, sha256_hex: createHash("sha256").update(pktJson).digest("hex") });
    }
    
    const pageProofContents: { sourceId: string; pageIndex: number; json: string; pngPath: string }[] = [];
    for (const src of sources) {
      const pdfPages = await storage.listPdfPagesBySource(src.id);
      for (const page of pdfPages) {
        const pageJsonData = {
          source_id: src.id,
          page_index: page.pageIndex,
          page_text_sha256_hex: page.pageTextSha256Hex
        };
        const pageJson = JSON.stringify(pageJsonData);
        pageProofContents.push({
          sourceId: src.id,
          pageIndex: page.pageIndex,
          json: pageJson,
          pngPath: page.pagePngPath
        });
        files.push({ path: `pages/${src.id}/page-${page.pageIndex}.json`, sha256_hex: createHash("sha256").update(pageJson).digest("hex") });
        const pngFullPath = join(UPLOADS_DIR, page.pagePngPath.replace(/^\/uploads\//, ""));
        try {
          const pngBuffer = await readFile(pngFullPath);
          const pngHash = createHash("sha256").update(pngBuffer).digest("hex");
          files.push({ path: `pages/${src.id}/page-${page.pageIndex}.png`, sha256_hex: pngHash });
        } catch (err) {
          console.warn(`Could not read PNG at ${pngFullPath}`);
        }
      }
    }
    
    const allAnchors = await storage.listAnchorRecordsByCorpus(corpusId);
    const pdfJsAnchors = allAnchors.filter(a => {
      if (!a.provenanceJson) return false;
      try {
        const prov = JSON.parse(a.provenanceJson);
        return prov.extractor?.name === "pdfjs-text-v1";
      } catch { return false; }
    });
    
    const pageTextHashMap = new Map<string, string>();
    for (const pageProof of pageProofContents) {
      const key = `${pageProof.sourceId}:${pageProof.pageIndex}`;
      const parsed = JSON.parse(pageProof.json);
      pageTextHashMap.set(key, parsed.page_text_sha256_hex);
    }
    
    const anchorsProofEntries = pdfJsAnchors.map(a => {
      const prov = JSON.parse(a.provenanceJson!);
      const key = `${prov.source_id}:${prov.page_index}`;
      return {
        anchor_id: a.id,
        source_id: prov.source_id,
        page_index: prov.page_index,
        quote_start_char: prov.quote_start_char,
        quote_end_char: prov.quote_end_char,
        page_text_sha256_hex: pageTextHashMap.get(key) || ""
      };
    }).sort((a, b) => a.anchor_id.localeCompare(b.anchor_id));
    
    const anchorsProofIndex = {
      corpus_id: corpusId,
      extractor: { name: "pdfjs-text-v1", version: "1.0.0" },
      anchors: anchorsProofEntries
    };
    const anchorsProofIndexJson = JSON.stringify(anchorsProofIndex);
    files.push({ path: "anchors_proof_index.json", sha256_hex: createHash("sha256").update(anchorsProofIndexJson).digest("hex") });
    
    const claimsList = await storage.listClaimRecordsByCorpus(corpusId);
    
    const sourcesByRole: Record<string, number> = {};
    for (const src of sources) {
      sourcesByRole[src.role] = (sourcesByRole[src.role] || 0) + 1;
    }
    const sortedSourcesByRole: Record<string, number> = {};
    for (const key of Object.keys(sourcesByRole).sort()) {
      sortedSourcesByRole[key] = sourcesByRole[key];
    }
    
    const anchorsBySourceId: Record<string, number> = {};
    for (const anchor of allAnchors) {
      anchorsBySourceId[anchor.sourceId] = (anchorsBySourceId[anchor.sourceId] || 0) + 1;
    }
    const sortedAnchorsBySourceId: Record<string, number> = {};
    for (const key of Object.keys(anchorsBySourceId).sort()) {
      sortedAnchorsBySourceId[key] = anchorsBySourceId[key];
    }
    
    const claimsByClassification: Record<string, number> = {
      "AMBIGUOUS": 0,
      "DEFENSIBLE": 0,
      "RESTRICTED": 0
    };
    for (const claim of claimsList) {
      if (claim.classification && claimsByClassification.hasOwnProperty(claim.classification)) {
        claimsByClassification[claim.classification]++;
      }
    }
    
    const ledgerByType: Record<string, number> = {
      "BUILD_RUN": 0,
      "CLAIM_CREATED": 0,
      "CLAIM_DELETED": 0,
      "CORPUS_CREATED": 0,
      "PACKET_CREATED": 0,
      "SNAPSHOT_CREATED": 0,
      "SOURCE_UPLOADED": 0
    };
    for (const evt of ledgerEvents) {
      if (ledgerByType.hasOwnProperty(evt.eventType)) {
        ledgerByType[evt.eventType]++;
      }
    }
    
    const hasPdfPages = pageProofContents.length > 0;
    
    const auditSummary = {
      corpus_id: corpusId,
      sources: {
        count: sources.length,
        by_role: sortedSourcesByRole
      },
      pages: {
        count: pageProofContents.length
      },
      anchors: {
        count: allAnchors.length,
        by_source_id: sortedAnchorsBySourceId
      },
      claims: {
        count: claimsList.length,
        by_classification: claimsByClassification
      },
      snapshots: {
        count: snapshotsList.length
      },
      packets: {
        count: packetsList.length
      },
      ledger_events: {
        count: ledgerEvents.length,
        by_type: ledgerByType
      },
      extractor: hasPdfPages 
        ? { name: "pdfjs-text-v1", version: "1.0.0" }
        : { name: null, version: null }
    };
    const auditSummaryJson = JSON.stringify(auditSummary);
    files.push({ path: "audit_summary.json", sha256_hex: createHash("sha256").update(auditSummaryJson).digest("hex") });
    
    const packetProofEntries = packetsList.map(pkt => ({
      packet_id: pkt.id,
      claim_id: pkt.claimId,
      snapshot_id: pkt.snapshotId,
      snapshot_hash_hex: pkt.snapshotHashHex,
      packet_hash_hex: pkt.hashHex
    })).sort((a, b) => a.packet_id.localeCompare(b.packet_id));
    
    const packetProofIndex = {
      corpus_id: corpusId,
      packets: packetProofEntries
    };
    const packetProofIndexJson = JSON.stringify(packetProofIndex);
    files.push({ path: "packet_proof_index.json", sha256_hex: createHash("sha256").update(packetProofIndexJson).digest("hex") });
    
    const snapshotProofEntries = snapshotsList.map(snap => ({
      snapshot_id: snap.id,
      created_at: snap.createdAt,
      hash_alg: snap.hashAlg,
      hash_hex: snap.hashHex
    })).sort((a, b) => a.snapshot_id.localeCompare(b.snapshot_id));
    
    const snapshotProofIndex = {
      corpus_id: corpusId,
      snapshots: snapshotProofEntries
    };
    const snapshotProofIndexJson = JSON.stringify(snapshotProofIndex);
    files.push({ path: "snapshot_proof_index.json", sha256_hex: createHash("sha256").update(snapshotProofIndexJson).digest("hex") });
    
    const ledgerProofEntries = ledgerEvents.map(e => ({
      event_id: e.id,
      occurred_at: e.occurredAt.toISOString(),
      event_type: e.eventType,
      entity_type: e.entityType,
      entity_id: e.entityId,
      hash_alg: e.hashAlg,
      hash_hex: e.hashHex
    })).sort((a, b) => a.event_id.localeCompare(b.event_id));
    
    const ledgerProofIndex = {
      corpus_id: corpusId,
      events: ledgerProofEntries
    };
    const ledgerProofIndexJson = JSON.stringify(ledgerProofIndex);
    files.push({ path: "ledger_proof_index.json", sha256_hex: createHash("sha256").update(ledgerProofIndexJson).digest("hex") });
    
    // v1.29: Generate audit_lines.txt
    const auditLines: string[] = [];
    for (const entry of anchorsProofEntries) {
      const pdfPage = await storage.getPdfPage(entry.source_id, entry.page_index);
      if (!pdfPage) continue;
      const substring = pdfPage.pageText.slice(entry.quote_start_char, entry.quote_end_char);
      const substringSha256Hex = createHash("sha256").update(substring, "utf8").digest("hex");
      auditLines.push(`${entry.anchor_id}|${entry.source_id}|${entry.page_index}|${entry.quote_start_char}|${entry.quote_end_char}|${pdfPage.pageTextSha256Hex}|${substringSha256Hex}`);
    }
    auditLines.sort((a, b) => a.localeCompare(b));
    const auditLinesTxt = auditLines.join("\n") + "\n";
    files.push({ path: "audit_lines.txt", sha256_hex: createHash("sha256").update(auditLinesTxt).digest("hex") });
    
    if (includeRawSources) {
      for (const src of sources) {
        const rawPath = `raw_sources/${src.id}__${src.filename}`;
        files.push({ path: rawPath, sha256_hex: src.sha256Hex });
      }
    }
    
    files.sort((a, b) => a.path.localeCompare(b.path));
    
    const manifestWithoutHash = {
      bundle_format: "lantern-corpus-bundle-v1",
      corpus_id: corpusId,
      include_raw_sources: includeRawSources,
      files: files,
      manifest_hash_alg: "SHA-256"
    };
    const manifestCanonical = JSON.stringify(manifestWithoutHash);
    const manifestHashHex = createHash("sha256").update(manifestCanonical).digest("hex");
    
    const manifest = {
      bundle_format: "lantern-corpus-bundle-v1",
      corpus_id: corpusId,
      generated_at: deterministic ? "1970-01-01T00:00:00.000Z" : new Date().toISOString(),
      include_raw_sources: includeRawSources,
      files: files,
      manifest_hash_alg: "SHA-256",
      manifest_hash_hex: manifestHashHex
    };
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="lantern-corpus-${corpusId}.zip"`);
    
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);
    
    const sortedPaths = [
      "MANIFEST.json",
      "corpus.json",
      "ledger.json",
      "sources.json",
      ...snapshotContents.map(s => `snapshots/${s.id}.json`).sort(),
      ...packetContents.map(p => `packets/${p.id}.json`).sort()
    ];
    
    if (includeRawSources) {
      for (const src of sources) {
        sortedPaths.push(`raw_sources/${src.id}__${src.filename}`);
      }
      sortedPaths.sort();
    }
    
    archive.append(JSON.stringify(manifest, null, 2), { name: `${bundleDir}/MANIFEST.json` });
    archive.append(corpusJson, { name: `${bundleDir}/corpus.json` });
    archive.append(ledgerJson, { name: `${bundleDir}/ledger.json` });
    archive.append(sourcesJson, { name: `${bundleDir}/sources.json` });
    
    for (const snap of snapshotContents) {
      archive.append(snap.json, { name: `${bundleDir}/snapshots/${snap.id}.json` });
    }
    
    for (const pkt of packetContents) {
      archive.append(pkt.json, { name: `${bundleDir}/packets/${pkt.id}.json` });
    }
    
    for (const pageProof of pageProofContents) {
      archive.append(pageProof.json, { name: `${bundleDir}/pages/${pageProof.sourceId}/page-${pageProof.pageIndex}.json` });
      const pngFullPath = join(UPLOADS_DIR, pageProof.pngPath.replace(/^\/uploads\//, ""));
      try {
        const pngBuffer = await readFile(pngFullPath);
        archive.append(pngBuffer, { name: `${bundleDir}/pages/${pageProof.sourceId}/page-${pageProof.pageIndex}.png` });
      } catch (err) {
        // PNG not available
      }
    }
    
    archive.append(anchorsProofIndexJson, { name: `${bundleDir}/anchors_proof_index.json` });
    archive.append(auditSummaryJson, { name: `${bundleDir}/audit_summary.json` });
    archive.append(packetProofIndexJson, { name: `${bundleDir}/packet_proof_index.json` });
    archive.append(snapshotProofIndexJson, { name: `${bundleDir}/snapshot_proof_index.json` });
    archive.append(ledgerProofIndexJson, { name: `${bundleDir}/ledger_proof_index.json` });
    archive.append(auditLinesTxt, { name: `${bundleDir}/audit_lines.txt` });
    
    await archive.finalize();
  }));

  // v1.10 Repro Pack endpoint
  app.get("/api/corpus/:corpusId/export_repro_pack", requireAuth, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    const includeRawSources = req.query.include_raw_sources === "true";
    const strict = req.query.strict !== "false";
    
    const corpus = await storage.getCorpus(corpusId);
    if (!corpus) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    // Generate the bundle ZIP in memory first
    const bundleArchive = archiver("zip", { zlib: { level: 9 } });
    const bundleChunks: Buffer[] = [];
    bundleArchive.on("data", (chunk) => bundleChunks.push(chunk));
    
    const sources = await storage.listCorpusSources(corpusId);
    const snapshots = await storage.listSnapshotsByCorpus(corpusId);
    const packets = await storage.listEvidencePacketsByCorpus(corpusId);
    const ledgerEvents = await storage.listLedgerEvents(corpusId, { limit: 10000 });
    
    const bundleDir = `lantern-corpus-${corpusId}`;
    
    const corpusJson = JSON.stringify({
      corpus_id: corpus.id,
      purpose: corpus.purpose,
      created_at: corpus.createdAt
    }, null, 2);
    
    const sourcesJson = JSON.stringify({
      corpus_id: corpusId,
      sources: sources.map(s => ({
        source_id: s.id,
        corpus_id: s.corpusId,
        role: s.role,
        filename: s.filename,
        uploaded_at: s.uploadedAt,
        sha256_hex: s.sha256Hex
      }))
    }, null, 2);
    
    const ledgerJson = JSON.stringify({
      corpus_id: corpusId,
      events: ledgerEvents.map(e => ({
        event_id: e.id,
        corpus_id: e.corpusId,
        event_type: e.eventType,
        entity_type: e.entityType,
        entity_id: e.entityId,
        payload: e.payloadJson ? JSON.parse(e.payloadJson) : null,
        created_at: e.occurredAt,
        hash_hex: e.hashHex
      }))
    }, null, 2);
    
    const files: Array<{ path: string; sha256_hex: string }> = [];
    files.push({ path: "corpus.json", sha256_hex: createHash("sha256").update(corpusJson).digest("hex") });
    files.push({ path: "ledger.json", sha256_hex: createHash("sha256").update(ledgerJson).digest("hex") });
    
    const snapshotContents: Array<{ id: string; json: string }> = [];
    for (const snap of snapshots) {
      const snapJson = JSON.stringify({
        snapshot_id: snap.id,
        corpus_id: snap.corpusId,
        created_at: snap.createdAt,
        hash_hex: snap.hashHex,
        snapshot_scope: snap.snapshotScopeJson ? JSON.parse(snap.snapshotScopeJson) : null
      }, null, 2);
      snapshotContents.push({ id: snap.id, json: snapJson });
      files.push({ path: `snapshots/${snap.id}.json`, sha256_hex: createHash("sha256").update(snapJson).digest("hex") });
    }
    
    const packetContents: Array<{ id: string; json: string }> = [];
    for (const pkt of packets) {
      const pktJson = JSON.stringify({
        packet_id: pkt.id,
        created_at: pkt.createdAt,
        ...JSON.parse(pkt.packetJson)
      }, null, 2);
      packetContents.push({ id: pkt.id, json: pktJson });
      files.push({ path: `packets/${pkt.id}.json`, sha256_hex: createHash("sha256").update(pktJson).digest("hex") });
    }
    
    files.push({ path: "sources.json", sha256_hex: createHash("sha256").update(sourcesJson).digest("hex") });
    
    if (includeRawSources) {
      for (const src of sources) {
        const rawPath = `raw_sources/${src.id}__${src.filename}`;
        files.push({ path: rawPath, sha256_hex: src.sha256Hex });
      }
    }
    
    files.sort((a, b) => a.path.localeCompare(b.path));
    
    const manifestWithoutHash = {
      bundle_format: "lantern-corpus-bundle-v1",
      corpus_id: corpusId,
      include_raw_sources: includeRawSources,
      files: files,
      manifest_hash_alg: "SHA-256"
    };
    const manifestCanonical = JSON.stringify(manifestWithoutHash);
    const manifestHashHex = createHash("sha256").update(manifestCanonical).digest("hex");
    
    const manifest = {
      bundle_format: "lantern-corpus-bundle-v1",
      corpus_id: corpusId,
      generated_at: "1970-01-01T00:00:00.000Z",
      include_raw_sources: includeRawSources,
      files: files,
      manifest_hash_alg: "SHA-256",
      manifest_hash_hex: manifestHashHex
    };
    
    bundleArchive.append(JSON.stringify(manifest, null, 2), { name: `${bundleDir}/MANIFEST.json` });
    bundleArchive.append(corpusJson, { name: `${bundleDir}/corpus.json` });
    bundleArchive.append(ledgerJson, { name: `${bundleDir}/ledger.json` });
    bundleArchive.append(sourcesJson, { name: `${bundleDir}/sources.json` });
    
    for (const snap of snapshotContents) {
      bundleArchive.append(snap.json, { name: `${bundleDir}/snapshots/${snap.id}.json` });
    }
    
    for (const pkt of packetContents) {
      bundleArchive.append(pkt.json, { name: `${bundleDir}/packets/${pkt.id}.json` });
    }
    
    await bundleArchive.finalize();
    const bundleBuffer = Buffer.concat(bundleChunks);
    
    // Read verifier files
    const verifierJs = await readFile(join(process.cwd(), "tools", "verify_bundle_standalone.js"), "utf8");
    const verifierPackageJson = await readFile(join(process.cwd(), "tools", "verifier_package.json"), "utf8");
    const verifierPackageLock = await readFile(join(process.cwd(), "tools", "verifier_package_lock.json"), "utf8");
    
    // Create INSTRUCTIONS.txt
    const instructions = `LANTERN REPRO PACK (v1)

Contents:
- bundle/lantern-corpus-${corpusId}.zip
- verifier/verify_bundle.js
- verifier/package.json
- verifier/package-lock.json

How to verify (requires Node.js 18+):
1) cd verifier
2) npm ci
3) node verify_bundle.js ../bundle/lantern-corpus-${corpusId}.zip --strict=${strict}

Expected result:
- "bundle_ok": true

Notes:
- This verifier checks MANIFEST.json integrity and file SHA-256 hashes.
- No network access is required.
`;
    
    // Build REPRO_MANIFEST
    const reproFiles: Array<{ path: string; sha256_hex: string }> = [
      { path: "INSTRUCTIONS.txt", sha256_hex: createHash("sha256").update(instructions).digest("hex") },
      { path: `bundle/lantern-corpus-${corpusId}.zip`, sha256_hex: createHash("sha256").update(bundleBuffer).digest("hex") },
      { path: "verifier/package-lock.json", sha256_hex: createHash("sha256").update(verifierPackageLock).digest("hex") },
      { path: "verifier/package.json", sha256_hex: createHash("sha256").update(verifierPackageJson).digest("hex") },
      { path: "verifier/verify_bundle.js", sha256_hex: createHash("sha256").update(verifierJs).digest("hex") },
    ];
    reproFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    const reproManifestWithoutHash = {
      repro_format: "lantern-repro-pack-v1",
      corpus_id: corpusId,
      include_raw_sources: includeRawSources,
      strict: strict,
      files: reproFiles,
      hash_alg: "SHA-256"
    };
    const reproManifestCanonical = JSON.stringify(reproManifestWithoutHash);
    const reproHashHex = createHash("sha256").update(reproManifestCanonical).digest("hex");
    
    const reproManifest = {
      repro_format: "lantern-repro-pack-v1",
      corpus_id: corpusId,
      include_raw_sources: includeRawSources,
      strict: strict,
      files: reproFiles,
      hash_alg: "SHA-256",
      hash_hex: reproHashHex
    };
    
    // Create the repro pack ZIP
    const reproDir = `lantern-repro-pack-${corpusId}`;
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="lantern-repro-pack-${corpusId}.zip"`);
    
    const reproArchive = archiver("zip", { zlib: { level: 9 } });
    reproArchive.on("error", (err) => { throw err; });
    reproArchive.pipe(res);
    
    reproArchive.append(JSON.stringify(reproManifest, null, 2), { name: `${reproDir}/REPRO_MANIFEST.json` });
    reproArchive.append(instructions, { name: `${reproDir}/INSTRUCTIONS.txt` });
    reproArchive.append(bundleBuffer, { name: `${reproDir}/bundle/lantern-corpus-${corpusId}.zip` });
    reproArchive.append(verifierJs, { name: `${reproDir}/verifier/verify_bundle.js` });
    reproArchive.append(verifierPackageJson, { name: `${reproDir}/verifier/package.json` });
    reproArchive.append(verifierPackageLock, { name: `${reproDir}/verifier/package-lock.json` });
    
    await reproArchive.finalize();
  }));

  // v1.8 Bundle Verification endpoint
  app.post("/api/bundles/verify", requireAuth, bundleUpload.single("bundle"), asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ type: "VALIDATION_ERROR", message: "No bundle file provided" });
    }

    const strict = req.query.strict !== "false";

    function createAdmZipReader(buffer: Buffer): ZipReader {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      return {
        async getEntries(): Promise<ZipEntry[]> {
          return entries.map((entry) => ({
            path: entry.entryName,
            async getData(): Promise<Buffer> {
              return entry.getData();
            },
          }));
        },
      };
    }

    const reader = createAdmZipReader(req.file.buffer);
    const result = await verifyBundle(reader, strict);
    res.json(result);
  }));

  // === VERIFIED RECORD API ===
  
  // Get canonical Verified Record for a corpus (JSON)
  app.get("/api/corpus/:corpusId/verified-record", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    
    const record = await generateVerifiedRecord(corpusId);
    if (!record) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    res.json(record);
  }));
  
  // Get Verified Record as PDF (human-readable text)
  app.get("/api/corpus/:corpusId/verified-record.pdf", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const corpusId = req.params.corpusId as string;
    
    const record = await generateVerifiedRecord(corpusId);
    if (!record) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Corpus not found"
      });
    }
    
    const pdfText = generateVerifiedRecordPDF(record);
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="verified-record-${corpusId}.txt"`);
    res.send(pdfText);
  }));

  // ========== INCIDENT REPORT ENDPOINTS ==========
  
  // Generate a new incident report
  app.post("/api/report/generate", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const { generateIncidentReport } = await import("./incidentReportGenerator");
    const { GenerateReportInputSchema } = await import("../shared/incidentReport");
    
    const parseResult = GenerateReportInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        type: "VALIDATION_ERROR",
        message: "Invalid input",
        errors: parseResult.error.flatten()
      });
    }
    
    const result = generateIncidentReport(parseResult.data);
    
    if (!result.report) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        refusals: result.refusals
      });
    }
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        report: result.report,
        markdown: result.markdown,
        refusals: result.refusals,
        errors: result.errors,
        message: "Report generation failed validation. Report not persisted."
      });
    }
    
    const reportRecord = await storage.createIncidentReport({
      caseId: result.report.case_id,
      organization: result.report.organization || null,
      environment: result.report.environment,
      status: result.report.status,
      authoringMode: result.report.authoring_mode,
      scopeBlockId: result.report.scope_limits_block_id,
      reportJson: JSON.stringify(result.report),
      markdownContent: result.markdown || null,
      immutableState: "draft",
      artifactHash: null,
      previousHash: null
    });
    
    return res.json({
      success: result.success,
      report_id: reportRecord.id,
      report: result.report,
      markdown: result.markdown,
      refusals: result.refusals,
      errors: result.errors
    });
  }));
  
  // Finalize an incident report (make it immutable)
  app.post("/api/report/:reportId/finalize", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const { finalizeReport, computeReportHash } = await import("./incidentReportGenerator");
    
    const reportId = req.params.reportId as string;
    const reportRecord = await storage.getIncidentReport(reportId);
    
    if (!reportRecord) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Report not found"
      });
    }
    
    if (reportRecord.immutableState === "finalized") {
      return res.status(400).json({
        type: "ALREADY_FINALIZED",
        message: "This report is already finalized and cannot be modified"
      });
    }
    
    const report = JSON.parse(reportRecord.reportJson);
    const finalizedReport = finalizeReport(report, reportRecord.previousHash || undefined);
    const hash = computeReportHash(finalizedReport);
    
    // Create an immutable artifact
    const artifact = await storage.createReportArtifact({
      reportId: reportId,
      artifactJson: JSON.stringify(finalizedReport),
      artifactMarkdown: reportRecord.markdownContent || "",
      artifactHash: hash,
      previousHash: reportRecord.previousHash || null
    });
    
    // Update the report record
    await storage.finalizeIncidentReport(reportId, hash);
    
    return res.json({
      success: true,
      report_id: reportId,
      artifact_id: artifact.id,
      artifact_hash: hash,
      finalized_at: new Date().toISOString(),
      report: finalizedReport
    });
  }));
  
  // Get an incident report by ID
  app.get("/api/report/:reportId", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const reportId = req.params.reportId as string;
    const reportRecord = await storage.getIncidentReport(reportId);
    
    if (!reportRecord) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Report not found"
      });
    }
    
    return res.json({
      id: reportRecord.id,
      case_id: reportRecord.caseId,
      status: reportRecord.status,
      immutable_state: reportRecord.immutableState,
      artifact_hash: reportRecord.artifactHash,
      created_at: reportRecord.createdAt,
      finalized_at: reportRecord.finalizedAt,
      report: JSON.parse(reportRecord.reportJson),
      markdown: reportRecord.markdownContent
    });
  }));
  
  // Get incident report as Markdown
  app.get("/api/report/:reportId.md", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const reportId = req.params.reportId as string;
    const reportRecord = await storage.getIncidentReport(reportId);
    
    if (!reportRecord) {
      return res.status(404).json({
        type: "NOT_FOUND",
        message: "Report not found"
      });
    }
    
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="report-${reportId}.md"`);
    res.send(reportRecord.markdownContent || "");
  }));
  
  // List all incident reports
  app.get("/api/reports", optionalAuthForPublicReadonly, asyncHandler(async (req, res) => {
    const reports = await storage.listIncidentReports();
    
    return res.json({
      reports: reports.map(r => ({
        id: r.id,
        case_id: r.caseId,
        organization: r.organization,
        status: r.status,
        immutable_state: r.immutableState,
        created_at: r.createdAt,
        finalized_at: r.finalizedAt
      }))
    });
  }));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API Error:", err);
    
    if (isDev) {
      res.status(500).json({
        type: "SERVER_ERROR",
        message: err.message,
        stack: err.stack
      });
    } else {
      res.status(500).json({
        type: "SERVER_ERROR",
        message: "Internal server error"
      });
    }
  });

  // Start the job processor
  startJobProcessor();

  return httpServer;
}
