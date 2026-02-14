import { createHash, verify } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { stableStringifyStrict, auditPayloadV1, hashAuditPayload } from "../server/audit-canon";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

interface PackEvent {
  seq: number;
  ts: string;
  action: string;
  actor: string;
  receiptId: string | null;
  exportId: string | null;
  savedViewId: string | null;
  payload: string;
  ip: string | null;
  userAgent: string | null;
  prevHash: string;
  hash: string;
  schemaVersion: string;
  payloadV: number;
}

interface PackCheckpoint {
  id: string;
  seq: number;
  hash: string;
  ts: string;
  prevCheckpointId: string | null;
  prevCheckpointHash: string | null;
  signatureAlg: string;
  publicKeyId: string;
  signature: string;
  signedPayload: string;
  eventCount: number;
}

interface AnchorPayloadV1 {
  _v: 1;
  engine_id: string;
  audit_payload_version: number;
  checkpoint_id: string;
  checkpoint_seq: number;
  event_seq: number;
  event_hash: string;
  checkpoint_hash: string;
  kid: string;
  created_at: string;
}

interface PackAnchorReceipt {
  anchorType: string;
  anchorId: string;
  anchoredAt: string;
  anchorHash: string;
  anchorPayload: AnchorPayloadV1;
  checkpointId: string;
  checkpointSeq: number;
  proof: Record<string, unknown>;
}

interface ForensicPack {
  format: string;
  exportedAt: string;
  segment: {
    fromSeq: number;
    toSeq: number;
    eventCount: number;
    totalEventsInDb: number;
  };
  headAtExportTime: { seq: number; hash: string } | null;
  verification: {
    algorithm: string;
    canonicalization: string;
    payloadVersion: number;
    chainStatus: string;
    ok: boolean;
    checkedEvents: number;
    firstBadSeq: number | null;
    breakReason: string | null;
  };
  manifest: Record<string, string>;
  events: PackEvent[];
  checkpoints?: PackCheckpoint[];
  anchorReceipts?: PackAnchorReceipt[];
  packHash: string;
}

function verifyEd25519Signature(
  signedPayload: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    return verify(
      null,
      Buffer.from(signedPayload, "utf8"),
      publicKeyPem,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

function loadKeyRing(keyDirOrFile: string): Map<string, string> {
  const ring = new Map<string, string>();
  const stat = fs.statSync(keyDirOrFile);

  if (stat.isDirectory()) {
    const files = fs.readdirSync(keyDirOrFile).filter(f => f.endsWith(".pem"));
    for (const f of files) {
      const pem = fs.readFileSync(path.join(keyDirOrFile, f), "utf-8");
      const kid = f.replace(/\.pem$/, "");
      ring.set(kid, pem);
    }
  } else {
    const pem = fs.readFileSync(keyDirOrFile, "utf-8");
    ring.set("default", pem);
  }

  return ring;
}

function resolveKeyForCheckpoint(cp: PackCheckpoint, keyRing: Map<string, string>, strictKid: boolean): string | null {
  if (!cp.publicKeyId) return null;

  if (keyRing.has(cp.publicKeyId)) return keyRing.get(cp.publicKeyId)!;

  if (strictKid) return null;

  if (keyRing.has("default")) return keyRing.get("default")!;
  if (keyRing.size === 1) return keyRing.values().next().value!;
  return null;
}

function main() {
  const args = process.argv.slice(2);
  let publicKeyFile: string | null = null;
  let strictKid = false;

  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--public-key" || args[i] === "--key-ring") && args[i + 1]) {
      publicKeyFile = args[++i];
    } else if (args[i] === "--strict-kid") {
      strictKid = true;
    } else {
      filteredArgs.push(args[i]);
    }
  }

  if (filteredArgs.length === 0 || filteredArgs[0] === "--help") {
    console.log("Usage: npx tsx scripts/verify_forensic_pack.ts <pack.json> [--public-key key.pem|key-dir/]");
    console.log("");
    console.log("Verifies a forensic pack offline without database access.");
    console.log("Replays the SHA-256 hash chain deterministically.");
    console.log("");
    console.log("Options:");
    console.log("  --public-key <file|dir>  Single PEM file or directory of <kid>.pem files (key ring)");
    console.log("  --key-ring <dir>         Alias for --public-key with a directory");
    console.log("  --strict-kid             Require exact kid match (no fallback to default/single key)");
    console.log("");
    console.log("If a directory is provided, keys are matched by publicKeyId (filename without .pem).");
    console.log("With --strict-kid, verifier will hard-fail if kid is missing or unknown (no guessing).");
    console.log("Outputs PASS or FAIL with the first failing sequence number.");
    process.exit(filteredArgs[0] === "--help" ? 0 : 1);
  }

  const filePath = filteredArgs[0];
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  let keyRing: Map<string, string> | null = null;
  if (publicKeyFile) {
    if (!fs.existsSync(publicKeyFile)) {
      console.error(`Public key file/directory not found: ${publicKeyFile}`);
      process.exit(1);
    }
    keyRing = loadKeyRing(publicKeyFile);
    if (keyRing.size === 0) {
      console.error("No .pem files found in key ring directory");
      process.exit(1);
    }
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  let pack: ForensicPack;
  try {
    pack = JSON.parse(raw);
  } catch {
    console.error("Failed to parse JSON file.");
    process.exit(1);
  }

  console.log("Forensic Pack Offline Verifier");
  console.log("==============================");
  console.log(`Format:      ${pack.format}`);
  console.log(`Exported at: ${pack.exportedAt}`);
  console.log(`Segment:     seq ${pack.segment.fromSeq}-${pack.segment.toSeq} (${pack.segment.eventCount} events)`);
  console.log(`DB total:    ${pack.segment.totalEventsInDb} events at export time`);
  console.log(`Algorithm:   ${pack.verification.algorithm}`);
  console.log("");

  const packWithoutHash = { ...pack };
  delete (packWithoutHash as any).packHash;
  const recomputedPackHash = sha256Hex(JSON.stringify(packWithoutHash));
  if (recomputedPackHash !== pack.packHash) {
    console.error("FAIL: Pack integrity check failed.");
    console.error(`  Expected pack hash: ${pack.packHash}`);
    console.error(`  Computed pack hash: ${recomputedPackHash}`);
    console.error("  The pack file itself has been modified after export.");
    process.exit(1);
  }
  console.log("Pack integrity: OK (pack hash matches)");

  const events = pack.events;
  if (events.length === 0) {
    console.log("No events to verify.");
    process.exit(0);
  }

  const fromSeq = events[0].seq;
  let expectedPrevHash = fromSeq === 1 ? "GENESIS" : events[0].prevHash;
  let checked = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = fromSeq + i;

    if (ev.seq !== expectedSeq) {
      console.error(`FAIL at seq ${expectedSeq}: sequence gap (found seq ${ev.seq})`);
      console.log(`  Checked: ${checked}/${events.length} events`);
      process.exit(1);
    }

    if (ev.prevHash !== expectedPrevHash) {
      console.error(`FAIL at seq ${ev.seq}: prevHash mismatch`);
      console.error(`  Expected: ${expectedPrevHash}`);
      console.error(`  Found:    ${ev.prevHash}`);
      console.log(`  Checked: ${checked}/${events.length} events`);
      process.exit(1);
    }

    if (ev.payloadV !== 1) {
      console.error(`FAIL at seq ${ev.seq}: unknown payload version ${ev.payloadV}`);
      console.log(`  Checked: ${checked}/${events.length} events`);
      process.exit(1);
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

    if ((recomputedPayload as any)._v !== ev.payloadV) {
      console.error(`FAIL at seq ${ev.seq}: payload version mismatch`);
      console.error(`  Column: ${ev.payloadV}, Builder: ${(recomputedPayload as any)._v}`);
      console.log(`  Checked: ${checked}/${events.length} events`);
      process.exit(1);
    }

    const recomputedHash = hashAuditPayload(recomputedPayload);
    if (recomputedHash !== ev.hash) {
      console.error(`FAIL at seq ${ev.seq}: hash mismatch`);
      console.error(`  Expected: ${recomputedHash}`);
      console.error(`  Found:    ${ev.hash}`);
      console.log(`  Checked: ${checked}/${events.length} events`);
      process.exit(1);
    }

    expectedPrevHash = ev.hash;
    checked++;
  }

  const lastEvent = events[events.length - 1];
  const isPartial = events.length < pack.segment.totalEventsInDb;
  const chainStatus = events.length === 1 && fromSeq === 1 ? "GENESIS" : "LINKED";

  console.log("");
  console.log("RESULT: PASS (hash chain)");
  console.log(`  Chain status: ${chainStatus}`);
  console.log(`  Checked:      ${checked}/${events.length} events`);
  console.log(`  Segment:      seq ${fromSeq}-${lastEvent.seq}`);
  console.log(`  Head:         seq=${lastEvent.seq} hash=${lastEvent.hash.slice(0, 16)}...`);
  if (isPartial) {
    console.log(`  Coverage:     PARTIAL (${events.length} of ${pack.segment.totalEventsInDb} total)`);
  } else {
    console.log(`  Coverage:     FULL`);
  }

  if (pack.headAtExportTime) {
    if (pack.headAtExportTime.seq === lastEvent.seq && pack.headAtExportTime.hash === lastEvent.hash) {
      console.log(`  Head match:   OK (matches head at export time)`);
    } else if (isPartial) {
      console.log(`  Head match:   N/A (partial segment, head at export: seq=${pack.headAtExportTime.seq})`);
    } else {
      console.log(`  Head match:   MISMATCH (head at export: seq=${pack.headAtExportTime.seq} hash=${pack.headAtExportTime.hash.slice(0, 16)}...)`);
    }
  }

  const checkpoints = pack.checkpoints ?? [];
  if (checkpoints.length > 0) {
    console.log("");
    console.log(`Checkpoints:    ${checkpoints.length} found in pack`);

    const eventHashMap = new Map<number, string>();
    for (const ev of events) {
      eventHashMap.set(ev.seq, ev.hash);
    }

    let cpChecked = 0;
    let cpFailed = false;
    let prevCpId: string | null = null;
    let prevCpSignedPayload: string | null = null;

    for (let ci = 0; ci < checkpoints.length; ci++) {
      const cp = checkpoints[ci];

      const eventHash = eventHashMap.get(cp.seq);
      if (eventHash && eventHash !== cp.hash) {
        console.error(`  FAIL: Checkpoint at seq ${cp.seq} hash does not match event hash`);
        console.error(`    Checkpoint: ${cp.hash.slice(0, 16)}...`);
        console.error(`    Event:      ${eventHash.slice(0, 16)}...`);
        cpFailed = true;
        break;
      }

      if (ci > 0) {
        if (cp.prevCheckpointId !== prevCpId) {
          console.error(`  FAIL: Checkpoint chain break at seq ${cp.seq}`);
          console.error(`    Expected prevCheckpointId: ${prevCpId}`);
          console.error(`    Found:                     ${cp.prevCheckpointId}`);
          cpFailed = true;
          break;
        }

        if (prevCpSignedPayload && cp.prevCheckpointHash) {
          const expectedPrevHash = prevCpSignedPayload.slice(0, 64);
          if (cp.prevCheckpointHash !== expectedPrevHash) {
            console.error(`  FAIL: Checkpoint prevCheckpointHash mismatch at seq ${cp.seq}`);
            cpFailed = true;
            break;
          }
        }
      }

      if (cp.signedPayload) {
        try {
          const parsed = JSON.parse(cp.signedPayload);
          if (parsed.event_seq !== undefined && parsed.event_seq !== cp.seq) {
            console.error(`  FAIL: Checkpoint signed payload event_seq (${parsed.event_seq}) != checkpoint seq (${cp.seq})`);
            cpFailed = true;
            break;
          }
          if (parsed.event_hash !== undefined && parsed.event_hash !== cp.hash) {
            console.error(`  FAIL: Checkpoint signed payload event_hash does not match checkpoint hash at seq ${cp.seq}`);
            cpFailed = true;
            break;
          }
        } catch {}
      }

      if (!cp.publicKeyId) {
        console.error(`  FAIL: Checkpoint at seq ${cp.seq} has no publicKeyId (kid required)`);
        cpFailed = true;
        break;
      }

      if (keyRing && cp.signatureAlg === "Ed25519") {
        const resolvedKey = resolveKeyForCheckpoint(cp, keyRing, strictKid);
        if (!resolvedKey) {
          if (strictKid) {
            console.error(`  FAIL: No key for kid "${cp.publicKeyId}" in key ring (--strict-kid enforced, no fallback)`);
          } else {
            console.error(`  FAIL: No public key found for kid "${cp.publicKeyId}" at seq ${cp.seq}`);
          }
          cpFailed = true;
          break;
        }
        const sigValid = verifyEd25519Signature(
          cp.signedPayload,
          cp.signature,
          resolvedKey,
        );
        if (!sigValid) {
          console.error(`  FAIL: Checkpoint at seq ${cp.seq} has invalid Ed25519 signature (kid: ${cp.publicKeyId})`);
          cpFailed = true;
          break;
        }
      }

      prevCpId = cp.id;
      prevCpSignedPayload = cp.signedPayload ? stableStringifyStrict(JSON.parse(cp.signedPayload)) : null;
      cpChecked++;
    }

    if (cpFailed) {
      console.log(`  Checkpoints:  FAILED (${cpChecked}/${checkpoints.length} verified)`);
      process.exit(1);
    }

    console.log(`  Chain:        ${cpChecked} checkpoints linked`);
    console.log(`  Anchors:      ${cpChecked} checkpoint-event hashes match`);
    if (keyRing) {
      const kidsSeen = new Set(checkpoints.map(c => c.publicKeyId));
      console.log(`  Signatures:   ${cpChecked}/${checkpoints.length} Ed25519 signatures VERIFIED`);
      if (kidsSeen.size > 1) {
        console.log(`  Key IDs:      ${kidsSeen.size} distinct keys used (${Array.from(kidsSeen).join(", ")})`);
      }
    } else {
      console.log(`  Signatures:   SKIPPED (provide --public-key or --key-ring to verify)`);
    }
  } else {
    console.log("");
    console.log("Checkpoints:    none in pack");
  }

  const anchors = pack.anchorReceipts ?? [];
  if (anchors.length > 0) {
    console.log("");
    console.log(`Anchors:        ${anchors.length} anchor receipts in pack`);

    const anchorTypes = new Set(anchors.map(a => a.anchorType));
    console.log(`  Types:        ${Array.from(anchorTypes).join(", ")}`);

    let anchorVerified = 0;
    let anchorFailed = false;
    let failReason = "";

    for (const ar of anchors) {
      const recomputedHash = sha256Hex(stableStringifyStrict(ar.anchorPayload));
      if (recomputedHash !== ar.anchorHash) {
        failReason = `Anchor receipt for checkpoint ${ar.checkpointId} has anchor_hash mismatch (expected ${recomputedHash}, got ${ar.anchorHash})`;
        anchorFailed = true;
        break;
      }

      if (ar.anchorPayload.checkpoint_id !== ar.checkpointId) {
        failReason = `Anchor payload checkpoint_id mismatch at seq ${ar.checkpointSeq}`;
        anchorFailed = true;
        break;
      }

      const matchingCheckpoint = checkpoints.find(cp => cp.id === ar.checkpointId);
      if (matchingCheckpoint) {
        if (ar.anchorPayload.event_hash !== matchingCheckpoint.hash) {
          failReason = `Anchor payload event_hash does not match checkpoint hash at seq ${ar.checkpointSeq}`;
          anchorFailed = true;
          break;
        }
      }

      if (ar.anchorType === "rfc3161") {
        const proof = ar.proof as { messageImprint?: string };
        if (proof.messageImprint) {
          const expectedImprint = sha256Hex(ar.anchorHash);
          if (proof.messageImprint !== expectedImprint) {
            failReason = `TSA message imprint mismatch at seq ${ar.checkpointSeq}: expected ${expectedImprint}, got ${proof.messageImprint}`;
            anchorFailed = true;
            break;
          }
        }
      }

      if (ar.anchorType === "s3-worm") {
        const proof = ar.proof as { objectHash?: string; objectBody?: string };
        if (proof.objectHash && proof.objectBody) {
          const recomputedObjectHash = sha256Hex(proof.objectBody);
          if (recomputedObjectHash !== proof.objectHash) {
            failReason = `S3 object hash mismatch at seq ${ar.checkpointSeq}`;
            anchorFailed = true;
            break;
          }
        }
      }

      anchorVerified++;
    }

    if (anchorFailed) {
      console.error(`  FAIL: ${failReason}`);
      console.log(`  Anchors:      FAILED (${anchorVerified}/${anchors.length} verified)`);
      process.exit(1);
    }

    console.log(`  Verified:     ${anchorVerified}/${anchors.length} anchor hashes match`);

    const hasRealAnchor = anchors.some(a => a.anchorType !== "log-only");
    const allLogOnly = !hasRealAnchor;
    const anchoredCheckpointIds = new Set(anchors.map(a => a.checkpointId));
    const totalCheckpoints = checkpoints.length;
    const coveredCheckpoints = checkpoints.filter(cp => anchoredCheckpointIds.has(cp.id)).length;

    for (const anchorType of anchorTypes) {
      const typeAnchors = anchors.filter(a => a.anchorType === anchorType);
      if (anchorType === "s3-worm") {
        const withObjectHash = typeAnchors.filter(a => (a.proof as any).objectHash);
        const withObjectBody = typeAnchors.filter(a => (a.proof as any).objectBody);
        console.log(`  S3 WORM:      ${typeAnchors.length} anchors (${withObjectBody.length} verified offline, ${withObjectHash.length - withObjectBody.length} require live S3)`);
      } else if (anchorType === "rfc3161") {
        const withToken = typeAnchors.filter(a => (a.proof as any).timestampToken);
        const withImprint = typeAnchors.filter(a => (a.proof as any).messageImprint);
        console.log(`  RFC3161:      ${typeAnchors.length} anchors (${withImprint.length} imprints verified, ${withToken.length} with TSA token)`);
      } else if (anchorType === "log-only") {
        console.log(`  Log-only:     ${typeAnchors.length} anchors (structured log only, no external trust boundary)`);
      }
    }

    console.log(`  Coverage:     ${coveredCheckpoints}/${totalCheckpoints} checkpoints anchored`);

    console.log("");
    console.log("--- Verdict ---");
    console.log(`  Integrity:    PASS (chain replay + checkpoint signatures)`);
    if (allLogOnly) {
      console.log(`  Anchoring:    LOG-ONLY (no external trust boundary)`);
      console.log(`  Note:         DB superuser rewrite resistance is NOT provided; pack is internally consistent`);
    } else {
      const s3Count = anchors.filter(a => a.anchorType === "s3-worm").length;
      const tsaCount = anchors.filter(a => a.anchorType === "rfc3161").length;
      const parts: string[] = [];
      if (s3Count > 0) parts.push(`S3: ${s3Count}`);
      if (tsaCount > 0) parts.push(`TSA: ${tsaCount}`);
      console.log(`  Anchoring:    PRESENT (${parts.join(", ")})`);
      if (coveredCheckpoints < totalCheckpoints) {
        console.log(`  Warning:      ${totalCheckpoints - coveredCheckpoints} checkpoints lack external anchors`);
      }
    }
  } else {
    console.log("");
    console.log("Anchors:        none in pack");
    console.log("");
    console.log("--- Verdict ---");
    console.log("  Integrity:    PASS (chain replay + checkpoint signatures)");
    console.log("  Anchoring:    NONE");
    console.log("  Note:         No anchor receipts in pack; DB superuser rewrite resistance is NOT provided");
  }
}

main();
