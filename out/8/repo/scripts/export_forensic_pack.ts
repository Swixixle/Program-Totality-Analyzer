import { createHash } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { asc, gte, lte, and, count, eq, desc } from "drizzle-orm";
import { auditEvents, auditHead, auditCheckpoints } from "../shared/schema";
import { auditPayloadV1, hashAuditPayload } from "../server/audit-canon";
import { getVersionInfo } from "../server/version";
import * as fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  let fromSeq: number | undefined;
  let toSeq: number | undefined;
  let outputFile = "forensic_pack.json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) fromSeq = parseInt(args[++i]);
    if (args[i] === "--to" && args[i + 1]) toSeq = parseInt(args[++i]);
    if (args[i] === "--output" && args[i + 1]) outputFile = args[++i];
    if (args[i] === "--help") {
      console.log("Usage: npx tsx scripts/export_forensic_pack.ts [--from N] [--to N] [--output file.json]");
      process.exit(0);
    }
  }

  console.log("Exporting forensic pack...");

  let events;
  if (fromSeq !== undefined && toSeq !== undefined) {
    events = await db.select().from(auditEvents)
      .where(and(gte(auditEvents.seq, fromSeq), lte(auditEvents.seq, toSeq)))
      .orderBy(asc(auditEvents.seq));
  } else if (fromSeq !== undefined) {
    events = await db.select().from(auditEvents)
      .where(gte(auditEvents.seq, fromSeq))
      .orderBy(asc(auditEvents.seq));
  } else if (toSeq !== undefined) {
    events = await db.select().from(auditEvents)
      .where(lte(auditEvents.seq, toSeq))
      .orderBy(asc(auditEvents.seq));
  } else {
    events = await db.select().from(auditEvents)
      .orderBy(asc(auditEvents.seq));
  }
  const [totalResult] = await db.select({ count: count() }).from(auditEvents);
  const totalEvents = totalResult?.count ?? 0;
  const [headRow] = await db.select().from(auditHead).where(eq(auditHead.id, 1)).limit(1);

  if (events.length === 0) {
    console.error("No audit events found in the specified range.");
    await pool.end();
    process.exit(1);
  }

  console.log(`Found ${events.length} events (total in DB: ${totalEvents})`);

  let chainOk = true;
  let firstBadSeq: number | null = null;
  let breakReason: string | null = null;
  const actualFromSeq = events[0].seq;
  const actualToSeq = events[events.length - 1].seq;
  let expectedPrevHash = actualFromSeq === 1 ? "GENESIS" : events[0].prevHash;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = actualFromSeq + i;

    if (ev.seq !== expectedSeq) {
      chainOk = false;
      firstBadSeq = expectedSeq;
      breakReason = "seq_gap";
      break;
    }

    if (ev.prevHash !== expectedPrevHash) {
      chainOk = false;
      firstBadSeq = ev.seq;
      breakReason = "prevHash_mismatch";
      break;
    }

    const recomputedPayload = auditPayloadV1({
      schemaVersion: ev.schemaVersion,
      seq: ev.seq,
      ts: ev.ts,
      action: ev.action,
      actor: ev.actor,
      receiptId: ev.receiptId,
      exportId: ev.exportId,
      savedViewId: ev.savedViewId,
      payload: ev.payload,
      ip: ev.ip,
      userAgent: ev.userAgent,
      prevHash: ev.prevHash,
    });

    const recomputedHash = hashAuditPayload(recomputedPayload);
    if (recomputedHash !== ev.hash) {
      chainOk = false;
      firstBadSeq = ev.seq;
      breakReason = "hash_mismatch";
      break;
    }

    expectedPrevHash = ev.hash;
  }

  const checkpointRows = await db.select().from(auditCheckpoints)
    .where(and(
      gte(auditCheckpoints.seq, actualFromSeq),
      lte(auditCheckpoints.seq, actualToSeq),
    ))
    .orderBy(asc(auditCheckpoints.seq));

  console.log(`Found ${checkpointRows.length} checkpoints in range`);

  const versionInfo = getVersionInfo();

  const anchorReceiptsRaw = process.env.ANCHOR_RECEIPTS_FILE
    ? JSON.parse(fs.readFileSync(process.env.ANCHOR_RECEIPTS_FILE, "utf-8"))
    : [];

  const pack = {
    format: "ai-receipts-forensic-pack/1.2",
    exportedAt: new Date().toISOString(),
    segment: {
      fromSeq: actualFromSeq,
      toSeq: actualToSeq,
      eventCount: events.length,
      totalEventsInDb: totalEvents,
    },
    headAtExportTime: headRow ? { seq: headRow.lastSeq, hash: headRow.lastHash } : null,
    verification: {
      algorithm: "SHA-256",
      canonicalization: "stableStringifyStrict (sorted keys, strict type rejection)",
      payloadVersion: 1,
      chainStatus: chainOk ? (events.length === 1 && actualFromSeq === 1 ? "GENESIS" : "LINKED") : "BROKEN",
      ok: chainOk,
      checkedEvents: events.length,
      firstBadSeq,
      breakReason,
    },
    system: {
      semver: versionInfo.semver,
      commit: versionInfo.commit,
      engineId: versionInfo.engineId,
      auditPayloadVersion: versionInfo.auditPayloadVersion,
    },
    manifest: {
      toolVersion: versionInfo.engineId,
      exportScript: "scripts/export_forensic_pack.ts",
      verifyScript: "scripts/verify_forensic_pack.ts",
      hashAlgorithm: "SHA-256",
      signatureAlgorithm: versionInfo.signatureAlgorithm,
      canonicalizationSpec: "Deterministic JSON: sorted keys, strict type rejection (no undefined, BigInt, Date, Map, Set, RegExp, Buffer, functions, symbols, NaN/Infinity, circular refs, dangerous keys)",
      signingKeyIds: [...new Set(checkpointRows.map(cp => cp.publicKeyId))].join(","),
    },
    events: events.map(ev => ({
      seq: ev.seq,
      ts: ev.ts,
      action: ev.action,
      actor: ev.actor,
      receiptId: ev.receiptId,
      exportId: ev.exportId,
      savedViewId: ev.savedViewId,
      payload: ev.payload,
      ip: ev.ip,
      userAgent: ev.userAgent,
      prevHash: ev.prevHash,
      hash: ev.hash,
      schemaVersion: ev.schemaVersion,
      payloadV: ev.payloadV,
    })),
    checkpoints: checkpointRows.map(cp => ({
      id: cp.id,
      seq: cp.seq,
      hash: cp.hash,
      ts: cp.ts,
      prevCheckpointId: cp.prevCheckpointId,
      prevCheckpointHash: cp.prevCheckpointHash,
      signatureAlg: cp.signatureAlg,
      publicKeyId: cp.publicKeyId,
      signature: cp.signature,
      signedPayload: cp.signedPayload,
      eventCount: cp.eventCount,
    })),
    anchorReceipts: anchorReceiptsRaw,
  };

  const packHash = sha256Hex(JSON.stringify(pack));
  const finalPack = { ...pack, packHash };

  fs.writeFileSync(outputFile, JSON.stringify(finalPack, null, 2));
  console.log(`\nForensic pack written to: ${outputFile}`);
  console.log(`  Events: ${events.length} (seq ${actualFromSeq}-${actualToSeq})`);
  console.log(`  Chain: ${chainOk ? "OK" : "BROKEN"}`);
  console.log(`  Pack hash: ${packHash}`);

  await pool.end();
}

main().catch(err => {
  console.error("Export failed:", err);
  process.exit(1);
});
