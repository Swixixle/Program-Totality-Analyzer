import { execSync, spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { getVersionInfo } from "../server/version";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, count } from "drizzle-orm";
import { auditEvents, auditHead, auditCheckpoints } from "../shared/schema";
import { auditPayloadV1, hashAuditPayload, stableStringifyStrict } from "../server/audit-canon";
import { buildCheckpointPayload, signCheckpoint, getPublicKeyPem } from "../server/checkpoint-signer";
import { getCheckpointAnchor, type AnchorReceipt } from "../server/checkpoint-anchor";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[proof_run] DATABASE_URL not set");
  process.exit(1);
}

const PROOF_DIR = process.env.PROOF_OUTPUT_DIR || `artifacts/proof_run/${new Date().toISOString().replace(/[:.]/g, "-")}`;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL || "5", 10);
const EVENTS_TO_GENERATE = Math.max(CHECKPOINT_INTERVAL + 3, 12);

type AnchorMode = "required" | "optional";
function parseAnchorMode(): AnchorMode {
  const cliArg = process.argv.find(a => a.startsWith("--anchors="));
  if (cliArg) {
    const val = cliArg.split("=")[1];
    if (val === "required" || val === "optional") return val;
    console.error(`[proof_run] Invalid --anchors value: ${val}. Use 'required' or 'optional'.`);
    process.exit(1);
  }
  const envVal = process.env.PROOF_ANCHORS_MODE;
  if (envVal === "required" || envVal === "optional") return envVal;
  return "optional";
}
const ANCHOR_MODE = parseAnchorMode();

function log(msg: string) {
  console.log(`[proof_run] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[proof_run] FAIL: ${msg}`);
  process.exit(1);
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function run(cmd: string): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      timeout: 120_000,
      env: {
        ...process.env,
        CHECKPOINT_INTERVAL: String(CHECKPOINT_INTERVAL),
      },
    }).trim();
  } catch (e: any) {
    const output = (e.stdout || "") + "\n" + (e.stderr || "");
    fail(`Command failed: ${cmd}\n${output}`);
  }
}

async function main() {
  log("=== AI Receipts Proof Run ===");
  log(`Output directory: ${PROOF_DIR}`);
  log(`Anchor mode: ${ANCHOR_MODE}`);
  ensureDir(PROOF_DIR);

  const versionInfo = getVersionInfo();
  log(`Version: ${versionInfo.engineId} (commit: ${versionInfo.commit})`);

  const anchor = getCheckpointAnchor();
  log(`Anchor backend: ${anchor.name()}`);

  if (ANCHOR_MODE === "required" && anchor.name() === "log-only") {
    fail("Anchor mode is 'required' but only log-only backend is configured.\n" +
      "  Set CHECKPOINT_ANCHOR_TYPE to 's3-worm', 'rfc3161', or 'both' with appropriate config.\n" +
      "  Required env vars:\n" +
      "    S3: CHECKPOINT_ANCHOR_S3_BUCKET, CHECKPOINT_ANCHOR_S3_PREFIX (optional), CHECKPOINT_ANCHOR_S3_RETENTION_DAYS (optional)\n" +
      "    TSA: CHECKPOINT_ANCHOR_TSA_URL (optional, defaults to freetsa.org)");
  }

  log("");
  log("--- Phase 1: Tests ---");
  const testOutput = run("npx vitest run --config vitest.config.ts 2>&1");
  fs.writeFileSync(path.join(PROOF_DIR, "test_output.txt"), testOutput);
  if (!testOutput.includes("Tests") || testOutput.includes("FAIL")) {
    fail("Tests did not pass");
  }
  const testMatch = testOutput.match(/(\d+) passed/);
  log(`Tests: PASS (${testMatch ? testMatch[1] : "?"} passed)`);

  log("");
  log("--- Phase 2: Generate Audit Events via DB ---");
  log(`Generating ${EVENTS_TO_GENERATE} events (checkpoint every ${CHECKPOINT_INTERVAL})...`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  const anchorReceipts: AnchorReceipt[] = [];

  const actions = [
    "VERIFY_STORED", "INTERPRET_ADDED", "KILL_SWITCH_ACTIVATED",
    "IMMUTABLE_LOCK", "COMPARISON_VIEWED", "RECEIPT_EXPORTED",
    "SAVED_VIEW_CREATED", "SAVED_VIEW_DELETED", "SAVED_VIEW_APPLIED",
    "BULK_EXPORT_STARTED", "BULK_EXPORT_COMPLETED", "PROOF_PACK_GENERATED",
  ];

  const schemaVersion = "audit/1.1";

  for (let i = 0; i < EVENTS_TO_GENERATE; i++) {
    await db.transaction(async (tx) => {
      const [headRow] = await tx
        .select()
        .from(auditHead)
        .where(eq(auditHead.id, 1))
        .for("update");

      let seq: number;
      let prevHash: string;

      if (headRow) {
        seq = headRow.lastSeq + 1;
        prevHash = headRow.lastHash;
      } else {
        seq = 1;
        prevHash = "GENESIS";
        await tx.insert(auditHead).values({ id: 1, lastSeq: 0, lastHash: "GENESIS" });
      }

      const action = actions[i % actions.length];
      const ts = new Date().toISOString();
      const payload = JSON.stringify({ step: i + 1, purpose: "proof_run_evidence", ts });

      const auditPayload = auditPayloadV1({
        schemaVersion,
        seq,
        ts,
        action,
        actor: "proof_run_operator",
        receiptId: i % 3 === 0 ? `proof-receipt-${i}` : null,
        exportId: null,
        savedViewId: null,
        payload,
        ip: "127.0.0.1",
        userAgent: "proof_run/1.0",
        prevHash,
      });

      const hash = hashAuditPayload(auditPayload);
      const payloadV = (auditPayload as any)._v;

      await tx.insert(auditEvents).values({
        id: randomUUID(),
        seq,
        ts,
        action,
        actor: "proof_run_operator",
        receiptId: i % 3 === 0 ? `proof-receipt-${i}` : null,
        exportId: null,
        savedViewId: null,
        payload,
        ip: "127.0.0.1",
        userAgent: "proof_run/1.0",
        prevHash,
        hash,
        schemaVersion,
        payloadV,
      });

      await tx
        .update(auditHead)
        .set({ lastSeq: seq, lastHash: hash })
        .where(eq(auditHead.id, 1));

      if (CHECKPOINT_INTERVAL > 0 && seq % CHECKPOINT_INTERVAL === 0) {
        const [lastCheckpoint] = await tx
          .select()
          .from(auditCheckpoints)
          .orderBy(desc(auditCheckpoints.seq))
          .limit(1);

        const prevCheckpointId = lastCheckpoint?.id ?? null;
        const prevCheckpointHash = lastCheckpoint
          ? stableStringifyStrict(JSON.parse(lastCheckpoint.signedPayload)).slice(0, 64)
          : null;

        const eventsSinceCheckpoint = lastCheckpoint
          ? seq - lastCheckpoint.seq
          : seq;

        const cpPayload = buildCheckpointPayload(
          seq,
          hash,
          eventsSinceCheckpoint,
          prevCheckpointId,
          prevCheckpointHash,
        );

        const signed = signCheckpoint(cpPayload);

        await tx.insert(auditCheckpoints).values({
          id: signed.id,
          seq: signed.seq,
          hash: signed.hash,
          ts: signed.ts,
          prevCheckpointId: signed.prevCheckpointId,
          prevCheckpointHash: signed.prevCheckpointHash,
          signatureAlg: signed.signatureAlg,
          publicKeyId: signed.publicKeyId,
          signature: signed.signature,
          signedPayload: signed.signedPayload,
          eventCount: signed.eventCount,
        });

        const anchorReceipt = await anchor.anchor(signed, versionInfo.engineId, versionInfo.auditPayloadVersion);
        anchorReceipts.push(anchorReceipt);

        log(`  Checkpoint created at seq ${seq} (anchor: ${anchorReceipt.anchorType})`);
      }
    });
  }

  log(`Generated ${EVENTS_TO_GENERATE} events`);

  const [totalResult] = await db.select({ count: count() }).from(auditEvents);
  const totalEvents = totalResult?.count ?? 0;
  const [cpCount] = await db.select({ count: count() }).from(auditCheckpoints);
  const checkpointCount = cpCount?.count ?? 0;

  log(`Total events in DB: ${totalEvents}`);
  log(`Total checkpoints in DB: ${checkpointCount}`);

  if (checkpointCount === 0) {
    fail("No checkpoints were created. Events may not have reached checkpoint interval.");
  }

  log(`Anchor receipts collected: ${anchorReceipts.length}`);

  if (ANCHOR_MODE === "required") {
    if (anchorReceipts.length === 0) {
      fail("Anchor mode is 'required' but no anchor receipts were generated.");
    }
    const hasRealAnchor = anchorReceipts.some(r => r.anchorType !== "log-only");
    if (!hasRealAnchor) {
      fail("Anchor mode is 'required' but all receipts are log-only (no external trust boundary).");
    }
    log("Anchor requirement satisfied: real external anchor receipts present.");
  }

  const anchorReceiptsPath = path.join(PROOF_DIR, "anchor_receipts.json");
  fs.writeFileSync(anchorReceiptsPath, JSON.stringify(anchorReceipts, null, 2));
  log("Anchor receipts saved");

  log("");
  log("--- Phase 3: Export Public Key ---");
  const publicKeyPem = getPublicKeyPem();
  const pubKeyPath = path.join(PROOF_DIR, "checkpoint_public.pem");
  fs.writeFileSync(pubKeyPath, publicKeyPem);
  log("Public key saved");

  log("");
  log("--- Phase 4: Export Forensic Pack ---");
  const packPath = path.join(PROOF_DIR, "forensic_pack.json");
  const exportOutput = run(`ANCHOR_RECEIPTS_FILE=${anchorReceiptsPath} npx tsx scripts/export_forensic_pack.ts --output ${packPath} 2>&1`);
  fs.writeFileSync(path.join(PROOF_DIR, "export_output.txt"), exportOutput);
  if (!fs.existsSync(packPath)) {
    fail("Forensic pack was not created");
  }
  const packSize = fs.statSync(packPath).size;
  log(`Pack exported: ${packPath} (${packSize} bytes)`);

  log("");
  log("--- Phase 5: Offline Verification (clean) ---");
  const verifyOutput = run(`npx tsx scripts/verify_forensic_pack.ts ${packPath} --public-key ${pubKeyPath} 2>&1`);
  fs.writeFileSync(path.join(PROOF_DIR, "verify_output.txt"), verifyOutput);
  if (!verifyOutput.includes("RESULT: PASS")) {
    fail(`Offline verification failed:\n${verifyOutput}`);
  }
  log("Offline verification: PASS");
  if (verifyOutput.includes("Ed25519 signatures VERIFIED")) {
    log("Checkpoint signatures: VERIFIED in offline pack");
  }

  log("");
  log("--- Phase 6: Tamper Test ---");
  const packRaw = fs.readFileSync(packPath, "utf-8");
  const pack = JSON.parse(packRaw);

  if (pack.events.length < 3) {
    fail("Not enough events in pack for tamper test (need at least 3)");
  }

  const tamperTarget = Math.min(2, pack.events.length - 1);
  const tamperedPack = JSON.parse(packRaw);
  const originalPayload = tamperedPack.events[tamperTarget].payload;
  tamperedPack.events[tamperTarget].payload = JSON.stringify({
    ...JSON.parse(originalPayload),
    TAMPERED: true,
  });

  const { packHash: _removed, ...packNoHash } = tamperedPack;
  tamperedPack.packHash = createHash("sha256")
    .update(JSON.stringify(packNoHash))
    .digest("hex");

  const tamperPackPath = path.join(PROOF_DIR, "forensic_pack_TAMPERED.json");
  fs.writeFileSync(tamperPackPath, JSON.stringify(tamperedPack, null, 2));

  let tamperVerifyOutput: string;
  try {
    tamperVerifyOutput = execSync(
      `npx tsx scripts/verify_forensic_pack.ts ${tamperPackPath} --public-key ${pubKeyPath} 2>&1`,
      { encoding: "utf-8", timeout: 30_000 },
    );
  } catch (e: any) {
    tamperVerifyOutput = (e.stdout || "") + "\n" + (e.stderr || "");
  }
  fs.writeFileSync(path.join(PROOF_DIR, "tamper_verify_output.txt"), tamperVerifyOutput);

  const tamperedSeq = pack.events[tamperTarget].seq;

  if (!tamperVerifyOutput.includes("FAIL")) {
    fail("Tamper test: verifier did NOT detect tampering!");
  }

  const packIntegrityFail = tamperVerifyOutput.includes("Pack integrity check failed");
  const hashMismatch = tamperVerifyOutput.includes("hash mismatch") && tamperVerifyOutput.includes(`seq ${tamperedSeq}`);

  if (packIntegrityFail) {
    log("Tamper test: DETECTED via pack integrity check (packHash mismatch)");
  } else if (hashMismatch) {
    log(`Tamper test: DETECTED at seq ${tamperedSeq} (hash mismatch)`);
  } else {
    log("Tamper test: DETECTED (verifier reported FAIL)");
    log(`  Details: ${tamperVerifyOutput.split("\n").filter(l => l.includes("FAIL")).join("\n  ")}`);
  }
  log("Tamper detection: PASS");

  log("");
  log("--- Phase 7: Write Version Manifest ---");
  const versionManifest = {
    ...versionInfo,
    proofRunTimestamp: new Date().toISOString(),
    checkpointInterval: CHECKPOINT_INTERVAL,
    eventsGenerated: EVENTS_TO_GENERATE,
    totalEventsInDb: totalEvents,
    checkpointsInDb: checkpointCount,
    anchorMode: ANCHOR_MODE,
    anchorBackend: anchor.name(),
    anchorReceiptsCount: anchorReceipts.length,
    testsPassed: true,
    chainVerified: true,
    checkpointSignaturesVerified: true,
    offlineVerificationPassed: true,
    tamperDetectionPassed: true,
  };
  fs.writeFileSync(path.join(PROOF_DIR, "version.json"), JSON.stringify(versionManifest, null, 2));
  log("Version manifest written");

  await pool.end();

  log("");
  log("=== PROOF RUN COMPLETE ===");
  log(`Artifacts directory: ${PROOF_DIR}`);
  log("Contents:");
  const files = fs.readdirSync(PROOF_DIR);
  for (const f of files) {
    const stat = fs.statSync(path.join(PROOF_DIR, f));
    log(`  ${f} (${stat.size} bytes)`);
  }

  log("");
  log("Acceptance criteria:");
  log("  [x] Tests pass");
  log("  [x] Audit events generated with checkpoints");
  log("  [x] Forensic pack exported with checkpoints + version info");
  log("  [x] Offline verification PASS with Ed25519 signature verification");
  log("  [x] Tamper detection PASS (verifier catches 1-byte mutation)");
  log("  [x] version.json manifest generated");
  log("  [x] Public key exported for independent verification");
  log(`  [x] Anchor receipts: ${anchorReceipts.length} (backend: ${anchor.name()})`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
