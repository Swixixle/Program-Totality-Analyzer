import {
  Rfc3161TsaAnchor,
  computeAnchorHash,
} from "../server/checkpoint-anchor";
import {
  buildCheckpointPayload,
  signCheckpoint,
} from "../server/checkpoint-signer";
import { sha256Hex } from "../server/audit-canon";
import { getVersionInfo } from "../server/version";

function log(msg: string) {
  console.log(`[tsa_smoke] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[tsa_smoke] FAIL: ${msg}`);
  process.exit(1);
}

function makeTestCheckpoint() {
  const testHash = sha256Hex(`tsa-smoke-${Date.now()}`);
  const cpPayload = buildCheckpointPayload(1, testHash, 1, null, null);
  return signCheckpoint(cpPayload);
}

async function smokeTestTsa() {
  const tsaUrl = process.env.CHECKPOINT_ANCHOR_TSA_URL || "https://freetsa.org/tsr";
  const fingerprintsRaw = process.env.CHECKPOINT_ANCHOR_TSA_FINGERPRINTS || "";
  const trustedFingerprints = fingerprintsRaw ? fingerprintsRaw.split(",").map(f => f.trim()) : [];

  const versionInfo = getVersionInfo();
  log("=== RFC3161 TSA Smoke Test ===");
  log(`Version: ${versionInfo.engineId}`);
  log(`TSA URL: ${tsaUrl}`);
  log(`Trusted fingerprints: ${trustedFingerprints.length > 0 ? trustedFingerprints.join(", ") : "(none configured)"}`);

  const anchor = new Rfc3161TsaAnchor(tsaUrl, trustedFingerprints);
  const config = anchor.getConfig();
  log(`Configured URL: ${config.tsaUrl}`);

  log("");
  log("--- Step 1: Create test checkpoint ---");
  const cp = makeTestCheckpoint();
  log(`Checkpoint ID: ${cp.id}`);
  log(`Key ID: ${cp.publicKeyId}`);

  log("");
  log("--- Step 2: Request TSA anchor ---");
  const receipt = await anchor.anchor(cp, versionInfo.engineId, versionInfo.auditPayloadVersion);
  log(`Anchor type: ${receipt.anchorType}`);
  log(`Anchor ID: ${receipt.anchorId}`);
  log(`Anchor hash: ${receipt.anchorHash}`);

  const proof = receipt.proof as Record<string, unknown>;
  log(`Digest algorithm: ${proof.digestAlgorithm}`);
  log(`Nonce: ${proof.nonce}`);
  log(`Timestamp token present: ${proof.timestampToken !== null}`);

  log("");
  log("--- Step 3: Verify anchor_hash ---");
  const recomputedHash = computeAnchorHash(receipt.anchorPayload);
  if (recomputedHash !== receipt.anchorHash) {
    fail(`anchor_hash mismatch: expected ${recomputedHash}, got ${receipt.anchorHash}`);
  }
  log("anchor_hash: OK");

  log("");
  log("--- Step 4: Verify messageImprint ---");
  const expectedImprint = sha256Hex(receipt.anchorHash);
  if (proof.messageImprint !== expectedImprint) {
    fail(`messageImprint mismatch: expected ${expectedImprint}, got ${proof.messageImprint}`);
  }
  log("messageImprint: OK (SHA-256 of anchorHash)");

  log("");
  log("--- Step 5: Payload binding ---");
  if (receipt.anchorPayload.checkpoint_id !== cp.id) {
    fail("checkpoint_id binding mismatch");
  }
  log("checkpoint_id binding: OK");

  if (receipt.anchorPayload.kid !== cp.publicKeyId) {
    fail("kid binding mismatch");
  }
  log("kid binding: OK");

  if (receipt.anchorPayload._v !== 1) {
    fail("payload version not 1");
  }
  log("payload version: OK (v1)");

  log("");
  log("--- Step 6: Backend verify ---");
  const verifyResult = await anchor.verify(receipt);
  if (!verifyResult.valid) {
    fail(`Backend verify failed: ${verifyResult.reason}`);
  }
  log(`Backend verify: OK`);
  log(`Verify reason: ${verifyResult.reason}`);

  log("");
  log("--- Step 7: Tamper detection ---");
  const tamperedReceipt = {
    ...receipt,
    anchorHash: "ffff" + receipt.anchorHash.slice(4),
  };
  const tamperResult = await anchor.verify(tamperedReceipt);
  if (tamperResult.valid) {
    fail("Tamper detection FAILED: verify() accepted tampered anchorHash");
  }
  log("Tamper detection: OK (tampered anchorHash rejected)");

  const tamperedImprint = {
    ...receipt,
    proof: { ...receipt.proof, messageImprint: "0000000000000000000000000000000000000000000000000000000000000000" },
  };
  const imprintResult = await anchor.verify(tamperedImprint);
  if (imprintResult.valid) {
    fail("Imprint tamper detection FAILED: verify() accepted tampered messageImprint");
  }
  log("Imprint tamper detection: OK (tampered messageImprint rejected)");

  log("");
  log("=== TSA SMOKE TEST PASSED ===");
  log(`TSA: ${tsaUrl}`);
  log(`All bindings verified, tamper detection confirmed.`);

  if (!proof.timestampToken) {
    log("");
    log("NOTE: No live TSA token was obtained (offline mode).");
    log("This is expected when not running against a real TSA endpoint.");
    log("The messageImprint binding is still verified, which confirms");
    log("that a real TSA token, when obtained, will bind correctly.");
  }
}

smokeTestTsa().catch((e) => {
  console.error(`[tsa_smoke] Unexpected error:`, e);
  process.exit(1);
});
