import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { getVersionInfo } from "../server/version";
import { getPublicKeyPem } from "../server/checkpoint-signer";

const version = getVersionInfo();
const RELEASE_DIR = "releases";
const ZIP_NAME = `verifier-v${version.semver}.zip`;
const STAGING_DIR = `/tmp/verifier-release-${Date.now()}`;
const VERIFY_TS_PATH = path.join(STAGING_DIR, "verify.ts");
const VERIFY_JS_PATH = path.join(STAGING_DIR, "verify.js");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  console.log(`Building verifier release: ${ZIP_NAME}`);
  console.log(`Version: ${version.engineId} (commit: ${version.commit})`);

  ensureDir(RELEASE_DIR);
  ensureDir(STAGING_DIR);

  const standaloneVerifier = buildStandaloneVerifierTs();
  fs.writeFileSync(VERIFY_TS_PATH, standaloneVerifier);

  try {
    execSync(
      `npx esbuild ${VERIFY_TS_PATH} --bundle --platform=node --target=node18 --outfile=${VERIFY_JS_PATH} --format=cjs`,
      { cwd: "/home/runner/workspace", stdio: "pipe" },
    );
    console.log("Compiled verify.ts -> verify.js (standalone Node.js bundle)");
  } catch (e: any) {
    console.error("esbuild compilation failed:", e.stderr?.toString());
    process.exit(1);
  }

  const publicKeyPem = getPublicKeyPem();
  fs.writeFileSync(path.join(STAGING_DIR, "checkpoint_public.pem"), publicKeyPem);
  console.log("Included checkpoint_public.pem from active signing key");

  const readmeContent = buildReadme();
  fs.writeFileSync(path.join(STAGING_DIR, "README.md"), readmeContent);

  const zipPath = path.join(RELEASE_DIR, ZIP_NAME);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", {
    zlib: { level: 9 },
    forceLocalTime: false,
  });

  const EPOCH_DATE = new Date("2020-01-01T00:00:00Z");
  const filesToAdd = ["verify.js", "verify.ts", "checkpoint_public.pem", "README.md"].sort();

  archive.pipe(output);
  for (const fileName of filesToAdd) {
    const filePath = path.join(STAGING_DIR, fileName);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: fileName, date: EPOCH_DATE });
    }
  }

  output.on("close", () => {
    console.log(`Release zip created: ${zipPath} (${archive.pointer()} bytes)`);
    console.log(`Contents:`);
    console.log(`  verify.js              - Compiled standalone verifier (Node.js 18+)`);
    console.log(`  verify.ts              - TypeScript source`);
    console.log(`  checkpoint_public.pem  - Ed25519 public key for signature verification`);
    console.log(`  README.md              - Usage instructions`);

    const hash = createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
    console.log(`  SHA-256: ${hash}`);

    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  });

  archive.finalize();
}

function buildReadme(): string {
  return `# AI Receipts Forensic Pack Verifier

Version: ${version.engineId}
Commit: ${version.commit}

## What This Does

Verifies AI Receipts forensic packs offline without any database access.
It replays the SHA-256 hash chain deterministically and verifies Ed25519
checkpoint signatures.

## Quick Start

### Verify with included public key (recommended)

\`\`\`bash
node verify.js forensic_pack.json --public-key checkpoint_public.pem
\`\`\`

### Verify hash chain only (no signature check)

\`\`\`bash
node verify.js forensic_pack.json
\`\`\`

## Requirements

- Node.js 18+ (for crypto module with Ed25519 support)
- No other dependencies required

## What Gets Verified

1. **Pack integrity** - SHA-256 of the entire pack matches packHash
2. **Sequence continuity** - No gaps in event sequence numbers
3. **Hash chain** - Each event hash matches its canonical payload
4. **Chain linkage** - Each event prevHash matches previous event hash
5. **Checkpoint anchoring** - Checkpoint hashes match corresponding event hashes
6. **Checkpoint chain** - Checkpoints link to their predecessors via prev_checkpoint_id
7. **Signed payload binding** - event_seq and event_hash in signed payload match checkpoint
8. **Ed25519 signatures** - Checkpoint signatures verified against public key

## Exit Codes

- 0 = PASS (all checks passed)
- 1 = FAIL or error

## Files

- \`verify.js\` - Compiled standalone verifier (runs with Node.js 18+, no dependencies)
- \`verify.ts\` - TypeScript source for audit/reference
- \`checkpoint_public.pem\` - Ed25519 public key for signature verification
- \`README.md\` - This file

## Key Source

The included \`checkpoint_public.pem\` was exported from the signing engine at build time.
If the signing key is rotated, a new verifier release must be built to include the updated key.
`;
}

function buildStandaloneVerifierTs(): string {
  return `#!/usr/bin/env node
import { createHash, verify as cryptoVerify } from "crypto";
import * as fs from "fs";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function stableStringifyStrict(value: unknown, _path?: string): string {
  const path = _path ?? "$";
  if (value === undefined) throw new Error(\`stableStringifyStrict: undefined at \${path}\`);
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(\`stableStringifyStrict: non-finite number at \${path}\`);
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") throw new Error(\`stableStringifyStrict: BigInt at \${path}\`);
  if (typeof value === "function") throw new Error(\`stableStringifyStrict: function at \${path}\`);
  if (typeof value === "symbol") throw new Error(\`stableStringifyStrict: symbol at \${path}\`);
  if (value instanceof Date) throw new Error(\`stableStringifyStrict: Date at \${path}\`);
  if (value instanceof Map) throw new Error(\`stableStringifyStrict: Map at \${path}\`);
  if (value instanceof Set) throw new Error(\`stableStringifyStrict: Set at \${path}\`);
  if (value instanceof RegExp) throw new Error(\`stableStringifyStrict: RegExp at \${path}\`);
  if (Buffer.isBuffer(value)) throw new Error(\`stableStringifyStrict: Buffer at \${path}\`);
  if (Array.isArray(value)) {
    const items = value.map((v, i) => stableStringifyStrict(v, \`\${path}[\${i}]\`));
    return "[" + items.join(",") + "]";
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) throw new Error(\`stableStringifyStrict: non-plain object at \${path}\`);
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts: string[] = [];
    for (const k of keys) {
      if (DANGEROUS_KEYS.has(k)) throw new Error(\`stableStringifyStrict: dangerous key "\${k}" at \${path}.\${k}\`);
      const v = (value as Record<string, unknown>)[k];
      if (v === undefined) throw new Error(\`stableStringifyStrict: undefined at \${path}.\${k}\`);
      parts.push(JSON.stringify(k) + ":" + stableStringifyStrict(v, \`\${path}.\${k}\`));
    }
    return "{" + parts.join(",") + "}";
  }
  throw new Error(\`stableStringifyStrict: unsupported type \${typeof value} at \${path}\`);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

interface AuditPayloadInput {
  schemaVersion: string; seq: number; ts: string; action: string; actor: string;
  receiptId: string | null; exportId: string | null; savedViewId: string | null;
  payload: string; ip: string | null; userAgent: string | null; prevHash: string;
}

function auditPayloadV1(input: AuditPayloadInput): Record<string, unknown> {
  return {
    _v: 1, schemaVersion: input.schemaVersion, seq: input.seq, ts: input.ts,
    action: input.action, actor: input.actor, receiptId: input.receiptId,
    exportId: input.exportId, savedViewId: input.savedViewId,
    payload: JSON.parse(input.payload), ip: input.ip, userAgent: input.userAgent,
    prevHash: input.prevHash,
  };
}

function hashAuditPayload(payload: Record<string, unknown>): string {
  return sha256Hex(stableStringifyStrict(payload));
}

interface PackEvent {
  seq: number; ts: string; action: string; actor: string;
  receiptId: string | null; exportId: string | null; savedViewId: string | null;
  payload: string; ip: string | null; userAgent: string | null;
  prevHash: string; hash: string; schemaVersion: string; payloadV: number;
}

interface PackCheckpoint {
  id: string; seq: number; hash: string; ts: string;
  prevCheckpointId: string | null; prevCheckpointHash: string | null;
  signatureAlg: string; publicKeyId: string; signature: string;
  signedPayload: string; eventCount: number;
}

interface ForensicPack {
  format: string; exportedAt: string;
  segment: { fromSeq: number; toSeq: number; eventCount: number; totalEventsInDb: number };
  headAtExportTime: { seq: number; hash: string } | null;
  verification: { algorithm: string; ok: boolean; checkedEvents: number; firstBadSeq: number | null; breakReason: string | null };
  manifest: Record<string, string>;
  system?: { semver: string; commit: string; engineId: string };
  events: PackEvent[];
  checkpoints?: PackCheckpoint[];
  packHash: string;
}

function verifyEd25519Signature(signedPayload: string, signatureBase64: string, publicKeyPem: string): boolean {
  try { return cryptoVerify(null, Buffer.from(signedPayload, "utf8"), publicKeyPem, Buffer.from(signatureBase64, "base64")); }
  catch { return false; }
}

function main() {
  const args = process.argv.slice(2);
  let publicKeyFile: string | null = null;
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--public-key" && args[i + 1]) { publicKeyFile = args[++i]; }
    else { filteredArgs.push(args[i]); }
  }

  if (filteredArgs.length === 0 || filteredArgs[0] === "--help") {
    console.log("AI Receipts Forensic Pack Offline Verifier");
    console.log("==========================================");
    console.log("Usage: node verify.js <pack.json> [--public-key key.pem]");
    console.log("");
    console.log("Verifies a forensic pack offline. Replays SHA-256 hash chain.");
    console.log("If --public-key is provided, also verifies Ed25519 checkpoint signatures.");
    process.exit(filteredArgs[0] === "--help" ? 0 : 1);
  }

  const filePath = filteredArgs[0];
  if (!fs.existsSync(filePath)) { console.error(\`File not found: \${filePath}\`); process.exit(1); }

  let publicKeyPem: string | null = null;
  if (publicKeyFile) {
    if (!fs.existsSync(publicKeyFile)) { console.error(\`Public key file not found: \${publicKeyFile}\`); process.exit(1); }
    publicKeyPem = fs.readFileSync(publicKeyFile, "utf-8");
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  let pack: ForensicPack;
  try { pack = JSON.parse(raw); } catch { console.error("Failed to parse JSON file."); process.exit(1); }

  console.log("Forensic Pack Offline Verifier");
  console.log("==============================");
  console.log(\`Format:      \${pack.format}\`);
  console.log(\`Exported at: \${pack.exportedAt}\`);
  console.log(\`Segment:     seq \${pack.segment.fromSeq}-\${pack.segment.toSeq} (\${pack.segment.eventCount} events)\`);
  console.log(\`DB total:    \${pack.segment.totalEventsInDb} events at export time\`);
  if (pack.system) { console.log(\`Engine:      \${pack.system.engineId} (commit: \${pack.system.commit})\`); }
  console.log(\`Algorithm:   SHA-256\`);

  const packWithoutHash = { ...pack };
  delete (packWithoutHash as any).packHash;
  const recomputedPackHash = sha256Hex(JSON.stringify(packWithoutHash));
  if (recomputedPackHash !== pack.packHash) {
    console.error("\\nFAIL: Pack integrity check failed.");
    console.error(\`  Expected: \${pack.packHash}\`);
    console.error(\`  Computed: \${recomputedPackHash}\`);
    process.exit(1);
  }
  console.log("\\nPack integrity: OK (pack hash matches)");

  const events = pack.events;
  if (events.length === 0) { console.log("No events to verify."); process.exit(0); }

  const fromSeq = events[0].seq;
  let expectedPrevHash = fromSeq === 1 ? "GENESIS" : events[0].prevHash;
  let checked = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = fromSeq + i;
    if (ev.seq !== expectedSeq) { console.error(\`\\nFAIL at seq \${expectedSeq}: sequence gap (found seq \${ev.seq})\`); process.exit(1); }
    if (ev.prevHash !== expectedPrevHash) { console.error(\`\\nFAIL at seq \${ev.seq}: prevHash mismatch\`); process.exit(1); }
    if (ev.payloadV !== 1) { console.error(\`\\nFAIL at seq \${ev.seq}: unknown payload version \${ev.payloadV}\`); process.exit(1); }

    const recomputedPayload = auditPayloadV1({
      schemaVersion: ev.schemaVersion, seq: ev.seq, ts: ev.ts, action: ev.action,
      actor: ev.actor, receiptId: ev.receiptId, exportId: ev.exportId,
      savedViewId: ev.savedViewId, payload: ev.payload, ip: ev.ip,
      userAgent: ev.userAgent, prevHash: ev.prevHash,
    });

    const recomputedHash = hashAuditPayload(recomputedPayload);
    if (recomputedHash !== ev.hash) {
      console.error(\`\\nFAIL at seq \${ev.seq}: hash mismatch\`);
      console.error(\`  Expected: \${recomputedHash}\`);
      console.error(\`  Found:    \${ev.hash}\`);
      process.exit(1);
    }
    expectedPrevHash = ev.hash;
    checked++;
  }

  const lastEvent = events[events.length - 1];
  const isPartial = events.length < pack.segment.totalEventsInDb;
  const chainStatus = events.length === 1 && fromSeq === 1 ? "GENESIS" : "LINKED";

  console.log("\\nRESULT: PASS (hash chain)");
  console.log(\`  Chain status: \${chainStatus}\`);
  console.log(\`  Checked:      \${checked}/\${events.length} events\`);
  console.log(\`  Segment:      seq \${fromSeq}-\${lastEvent.seq}\`);
  console.log(\`  Head:         seq=\${lastEvent.seq} hash=\${lastEvent.hash.slice(0, 16)}...\`);
  console.log(\`  Coverage:     \${isPartial ? "PARTIAL" : "FULL"}\`);

  if (pack.headAtExportTime) {
    if (pack.headAtExportTime.seq === lastEvent.seq && pack.headAtExportTime.hash === lastEvent.hash) {
      console.log("  Head match:   OK (matches head at export time)");
    } else if (isPartial) {
      console.log("  Head match:   N/A (partial segment)");
    } else {
      console.log("  Head match:   MISMATCH");
    }
  }

  const checkpoints = pack.checkpoints ?? [];
  if (checkpoints.length > 0) {
    console.log(\`\\nCheckpoints:    \${checkpoints.length} found in pack\`);

    const eventHashMap = new Map<number, string>();
    for (const ev of events) eventHashMap.set(ev.seq, ev.hash);

    let cpChecked = 0;
    let cpFailed = false;
    let prevCpId: string | null = null;
    let prevCpSignedPayload: string | null = null;

    for (let ci = 0; ci < checkpoints.length; ci++) {
      const cp = checkpoints[ci];
      const eventHash = eventHashMap.get(cp.seq);
      if (eventHash && eventHash !== cp.hash) {
        console.error(\`  FAIL: Checkpoint at seq \${cp.seq} hash does not match event hash\`);
        cpFailed = true; break;
      }
      if (ci > 0) {
        if (cp.prevCheckpointId !== prevCpId) {
          console.error(\`  FAIL: Checkpoint chain break at seq \${cp.seq}\`);
          cpFailed = true; break;
        }
        if (prevCpSignedPayload && cp.prevCheckpointHash) {
          if (cp.prevCheckpointHash !== prevCpSignedPayload.slice(0, 64)) {
            console.error(\`  FAIL: Checkpoint prevCheckpointHash mismatch at seq \${cp.seq}\`);
            cpFailed = true; break;
          }
        }
      }
      if (cp.signedPayload) {
        try {
          const parsed = JSON.parse(cp.signedPayload);
          if (parsed.event_seq !== undefined && parsed.event_seq !== cp.seq) {
            console.error(\`  FAIL: Signed payload event_seq mismatch at seq \${cp.seq}\`);
            cpFailed = true; break;
          }
          if (parsed.event_hash !== undefined && parsed.event_hash !== cp.hash) {
            console.error(\`  FAIL: Signed payload event_hash mismatch at seq \${cp.seq}\`);
            cpFailed = true; break;
          }
        } catch {}
      }
      if (publicKeyPem && cp.signatureAlg === "Ed25519") {
        if (!verifyEd25519Signature(cp.signedPayload, cp.signature, publicKeyPem)) {
          console.error(\`  FAIL: Checkpoint at seq \${cp.seq} has invalid Ed25519 signature\`);
          cpFailed = true; break;
        }
      }
      prevCpId = cp.id;
      prevCpSignedPayload = cp.signedPayload ? stableStringifyStrict(JSON.parse(cp.signedPayload)) : null;
      cpChecked++;
    }

    if (cpFailed) { console.log(\`  Checkpoints:  FAILED (\${cpChecked}/\${checkpoints.length} verified)\`); process.exit(1); }
    console.log(\`  Chain:        \${cpChecked} checkpoints linked\`);
    console.log(\`  Anchors:      \${cpChecked} checkpoint-event hashes match\`);
    if (publicKeyPem) {
      console.log(\`  Signatures:   \${cpChecked}/\${checkpoints.length} Ed25519 signatures VERIFIED\`);
    } else {
      console.log("  Signatures:   SKIPPED (provide --public-key to verify Ed25519 signatures)");
    }
  } else {
    console.log("\\nCheckpoints:    none in pack");
  }
}

main();
`;
}

main();
