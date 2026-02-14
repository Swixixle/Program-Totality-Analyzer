import archiver from "archiver";
import { createWriteStream } from "fs";
import { mkdir, unlink, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Receipt } from "@shared/schema";
import { storage } from "./storage";

const EXPORT_DIR = "/tmp/bulk-exports";
const MAX_ALL_RESULTS = 10000;
const CHUNK_SIZE = 200;

export interface ExportFilters {
  status?: string;
  q?: string;
  hasForensics?: boolean;
  killSwitch?: boolean;
}

export interface ExportManifest {
  schema: "ai-receipt/bulk-export/1.0";
  exportId: string;
  requestedAt: string;
  generatedAt: string;
  scope: "current_page" | "all_results";
  filters: ExportFilters;
  totalReceipts: number;
  page?: number;
  pageSize?: number;
  columns: string[];
  capApplied: boolean;
  capLimit: number;
  expiresAt: string;
}

const CSV_COLUMNS = [
  "receipt_id",
  "platform",
  "verification_status",
  "signature_status",
  "chain_status",
  "kill_switch",
  "captured_at",
  "verified_at",
  "created_at",
];

function escCsv(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function receiptToCsvRow(r: Receipt): string {
  return [
    escCsv(r.receiptId),
    escCsv(r.platform),
    escCsv(r.verificationStatus),
    escCsv(r.signatureStatus),
    escCsv(r.chainStatus),
    r.hindsightKillSwitch === 1 ? "true" : "false",
    escCsv(r.capturedAt),
    escCsv(r.verifiedAt),
    escCsv(r.createdAt),
  ].join(",");
}

function receiptToJsonlEntry(r: Receipt): object {
  const entry: Record<string, unknown> = {
    receipt_id: r.receiptId,
    platform: r.platform,
    verification_status: r.verificationStatus,
    signature_status: r.signatureStatus,
    chain_status: r.chainStatus,
    kill_switch: r.hindsightKillSwitch === 1,
    captured_at: r.capturedAt,
    verified_at: r.verifiedAt,
    created_at: r.createdAt,
    hash_match: r.hashMatch === 1,
    expected_hash_sha256: r.expectedHashSha256,
    computed_hash_sha256: r.computedHashSha256,
  };

  if (r.forensicsJson) {
    try {
      entry.forensics = typeof r.forensicsJson === "object" ? r.forensicsJson : JSON.parse(r.forensicsJson);
    } catch {
      entry.forensics = null;
    }
  }

  if (r.hindsightKillSwitch !== 1 && r.rawJson) {
    try {
      const capsule = typeof r.rawJson === "object" ? r.rawJson : JSON.parse(r.rawJson);
      entry.capsule = capsule;
    } catch {
      entry.capsule = null;
    }
  }

  return entry;
}

function receiptToProofUrl(r: Receipt): string {
  const proofUrl = `/api/public/receipts/${encodeURIComponent(r.receiptId)}/verify`;
  return `${escCsv(r.receiptId)},${escCsv(proofUrl)}`;
}

const README_TEXT = `AI Receipts Bulk Export
======================

This archive contains forensic receipt data exported from the AI Receipts verification system.

Files:
- receipts.jsonl: One receipt per line in JSON format (includes forensics when available)
- receipts.csv: Metadata-only CSV for spreadsheet import
- proof_urls.csv: Public verification URLs for each receipt
- manifest.json: Export metadata (filters, counts, generation time, cap/expiry info)
- README.txt: This file

Notes:
- Receipts with kill switch engaged have capsule data redacted from JSONL
- Forensic data is included as-is from the verification engine
- Proof URLs point to the public verification endpoint
- This export reflects a point-in-time snapshot (see manifest.json requestedAt)

Operational Limits:
- Exports are capped at ${MAX_ALL_RESULTS.toLocaleString()} receipts per job
- Export files expire after 1 hour and are automatically cleaned up
- If your result set exceeds the cap, use filters to narrow results or export in batches
- Check manifest.json capApplied field to determine if truncation occurred

Schema: ai-receipt/bulk-export/1.0
`;

export async function ensureExportDir(): Promise<void> {
  await mkdir(EXPORT_DIR, { recursive: true });
}

export function getExportFilePath(exportId: string): string {
  return path.join(EXPORT_DIR, `${exportId}.zip`);
}

export async function exportFileExists(exportId: string): Promise<boolean> {
  try {
    await stat(getExportFilePath(exportId));
    return true;
  } catch {
    return false;
  }
}

export async function cleanupExportFile(exportId: string): Promise<void> {
  try {
    await unlink(getExportFilePath(exportId));
  } catch {
    // ignore
  }
}

export async function generateBulkExport(
  exportId: string,
  scope: "current_page" | "all_results",
  filters: ExportFilters,
  requestedAt: string,
  expiresAt: string,
  page?: number,
  pageSize?: number,
): Promise<void> {
  await ensureExportDir();
  const filePath = getExportFilePath(exportId);

  try {
    let allReceipts: Receipt[] = [];
    let capApplied = false;

    if (scope === "current_page") {
      const result = await storage.getPagedReceipts({
        page: page || 1,
        pageSize: pageSize || 50,
        status: filters.status,
        q: filters.q,
        hasForensics: filters.hasForensics,
        killSwitch: filters.killSwitch,
        order: "desc",
        beforeDate: requestedAt,
      });
      allReceipts = result.items;

      await storage.updateExportJob(exportId, { total: result.items.length });
    } else {
      const countResult = await storage.getPagedReceipts({
        page: 1,
        pageSize: 1,
        status: filters.status,
        q: filters.q,
        hasForensics: filters.hasForensics,
        killSwitch: filters.killSwitch,
        order: "desc",
        beforeDate: requestedAt,
      });

      const total = Math.min(countResult.total, MAX_ALL_RESULTS);
      capApplied = countResult.total > MAX_ALL_RESULTS;
      await storage.updateExportJob(exportId, { total });

      let fetched = 0;
      let currentPage = 1;
      while (fetched < total) {
        const chunk = await storage.getPagedReceipts({
          page: currentPage,
          pageSize: CHUNK_SIZE,
          status: filters.status,
          q: filters.q,
          hasForensics: filters.hasForensics,
          killSwitch: filters.killSwitch,
          order: "desc",
          beforeDate: requestedAt,
        });

        allReceipts.push(...chunk.items);
        fetched += chunk.items.length;
        currentPage++;

        await storage.updateExportJob(exportId, { completed: fetched });

        if (chunk.items.length < CHUNK_SIZE) break;
      }
    }

    const archive = archiver("zip", { zlib: { level: 6 } });
    const output = createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      const jsonlLines = allReceipts.map(r => JSON.stringify(receiptToJsonlEntry(r))).join("\n");
      archive.append(jsonlLines + "\n", { name: "receipts.jsonl" });

      const csvHeader = CSV_COLUMNS.join(",");
      const csvRows = allReceipts.map(receiptToCsvRow);
      archive.append([csvHeader, ...csvRows].join("\n") + "\n", { name: "receipts.csv" });

      const proofHeader = "receipt_id,proof_url";
      const proofRows = allReceipts.map(receiptToProofUrl);
      archive.append([proofHeader, ...proofRows].join("\n") + "\n", { name: "proof_urls.csv" });

      const manifest: ExportManifest = {
        schema: "ai-receipt/bulk-export/1.0",
        exportId,
        requestedAt,
        generatedAt: new Date().toISOString(),
        scope,
        filters,
        totalReceipts: allReceipts.length,
        columns: CSV_COLUMNS,
        capApplied,
        capLimit: MAX_ALL_RESULTS,
        expiresAt,
      };
      if (scope === "current_page") {
        manifest.page = page;
        manifest.pageSize = pageSize;
      }
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

      archive.append(README_TEXT, { name: "README.txt" });

      archive.finalize();
    });

    await storage.updateExportJob(exportId, {
      status: "READY",
      completed: allReceipts.length,
      filePath,
    });
    try {
      await storage.appendAuditEvent({
        action: "EXPORT_READY",
        actor: "operator", exportId,
        payload: JSON.stringify({ total: allReceipts.length }),
      });
    } catch {}
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await storage.updateExportJob(exportId, {
      status: "FAILED",
      errorMessage: message,
    });
    try {
      await storage.appendAuditEvent({
        action: "EXPORT_FAILED",
        actor: "operator", exportId,
        payload: JSON.stringify({ error: message }),
      });
    } catch {}
    await cleanupExportFile(exportId);
  }
}
