import {
  computeAnchorHash,
  getCheckpointAnchor,
  resetAnchor,
} from "../server/checkpoint-anchor";
import {
  buildCheckpointPayload,
  signCheckpoint,
} from "../server/checkpoint-signer";
import { sha256Hex } from "../server/audit-canon";
import { getVersionInfo } from "../server/version";

function log(msg: string) {
  console.log(`[anchor_smoke] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[anchor_smoke] FAIL: ${msg}`);
  process.exit(1);
}

function makeTestCheckpoint() {
  const testHash = sha256Hex(`smoke-test-${Date.now()}`);
  const cpPayload = buildCheckpointPayload(1, testHash, 1, null, null);
  return signCheckpoint(cpPayload);
}

async function smokeTestAnchor() {
  const versionInfo = getVersionInfo();
  log("=== Anchor Smoke Test ===");
  log(`Version: ${versionInfo.engineId}`);

  resetAnchor();
  const anchor = getCheckpointAnchor();
  const anchorName = anchor.name();
  log(`Anchor backend: ${anchorName}`);

  if (anchorName === "log-only") {
    log("WARNING: Only log-only backend configured.");
    log("Set CHECKPOINT_ANCHOR_TYPE and appropriate config for real anchor testing.");
    log("Running log-only smoke test for baseline validation...");
  }

  if (anchorName === "s3-worm" || anchorName.startsWith("multi")) {
    const s3Bucket = process.env.CHECKPOINT_ANCHOR_S3_BUCKET;
    const retentionMode = process.env.CHECKPOINT_ANCHOR_S3_RETENTION_MODE || "GOVERNANCE";
    const retentionDays = process.env.CHECKPOINT_ANCHOR_S3_RETENTION_DAYS || "90";
    log(`S3 Bucket: ${s3Bucket}`);
    log(`Retention: ${retentionMode} / ${retentionDays} days`);
  }

  if (anchorName === "rfc3161" || anchorName.startsWith("multi")) {
    const tsaUrl = process.env.CHECKPOINT_ANCHOR_TSA_URL || "https://freetsa.org/tsr";
    log(`TSA URL: ${tsaUrl}`);
  }

  log("");
  log("--- Step 1: Create test checkpoint ---");
  const cp = makeTestCheckpoint();
  log(`Checkpoint ID: ${cp.id}`);
  log(`Checkpoint seq: ${cp.seq}`);
  log(`Key ID: ${cp.publicKeyId}`);

  log("");
  log("--- Step 2: Anchor the checkpoint ---");
  const receipt = await anchor.anchor(cp, versionInfo.engineId, versionInfo.auditPayloadVersion);
  log(`Anchor type: ${receipt.anchorType}`);
  log(`Anchor ID: ${receipt.anchorId}`);
  log(`Anchor hash: ${receipt.anchorHash}`);

  log("");
  log("--- Step 3: Verify anchor receipt ---");

  const recomputedHash = computeAnchorHash(receipt.anchorPayload);
  if (recomputedHash !== receipt.anchorHash) {
    fail(`anchor_hash mismatch: expected ${recomputedHash}, got ${receipt.anchorHash}`);
  }
  log("anchor_hash: OK (recomputed matches)");

  if (receipt.anchorPayload.checkpoint_id !== cp.id) {
    fail(`checkpoint_id binding mismatch`);
  }
  log("checkpoint_id binding: OK");

  if (receipt.anchorPayload.kid !== cp.publicKeyId) {
    fail(`kid binding mismatch`);
  }
  log("kid binding: OK");

  if (receipt.anchorPayload._v !== 1) {
    fail(`payload version not 1`);
  }
  log("payload version: OK (v1)");

  const proof = receipt.proof as Record<string, unknown>;

  if (receipt.anchorType === "s3-worm") {
    if (!proof.objectBody || !proof.objectHash) {
      fail("S3 proof missing objectBody or objectHash");
    }
    const recomputedObjectHash = sha256Hex(proof.objectBody as string);
    if (recomputedObjectHash !== proof.objectHash) {
      fail(`objectHash mismatch: expected ${recomputedObjectHash}, got ${proof.objectHash}`);
    }
    log("objectHash: OK (objectBody hash matches)");

    const parsed = JSON.parse(proof.objectBody as string);
    if (parsed.anchor_hash !== receipt.anchorHash) {
      fail("objectBody anchor_hash does not match receipt anchorHash");
    }
    log("objectBody binding: OK (anchor_hash matches)");
  }

  if (receipt.anchorType === "rfc3161") {
    if (!proof.messageImprint) {
      fail("RFC3161 proof missing messageImprint");
    }
    const expectedImprint = sha256Hex(receipt.anchorHash);
    if (proof.messageImprint !== expectedImprint) {
      fail(`messageImprint mismatch: expected ${expectedImprint}, got ${proof.messageImprint}`);
    }
    log("messageImprint: OK (SHA-256 of anchorHash)");
  }

  log("");
  log("--- Step 4: Verify via backend verify() ---");
  const verifyResult = await anchor.verify(receipt);
  if (!verifyResult.valid) {
    fail(`Backend verify() failed: ${verifyResult.reason}`);
  }
  log(`Backend verify: OK (${verifyResult.reason || "valid"})`);

  log("");
  log("--- Step 5: Tamper detection ---");
  const tamperedReceipt = {
    ...receipt,
    anchorHash: "0000000000000000000000000000000000000000000000000000000000000000",
  };
  const tamperResult = await anchor.verify(tamperedReceipt);
  if (tamperResult.valid) {
    fail("Tamper detection FAILED: verify() accepted tampered anchorHash");
  }
  log("Tamper detection: OK (tampered anchorHash rejected)");

  log("");
  log("=== SMOKE TEST PASSED ===");
  log(`Backend: ${anchorName}`);
  log(`Anchor type: ${receipt.anchorType}`);
  log(`All bindings verified, tamper detection confirmed.`);
}

smokeTestAnchor().catch((e) => {
  console.error(`[anchor_smoke] Unexpected error:`, e);
  process.exit(1);
});
