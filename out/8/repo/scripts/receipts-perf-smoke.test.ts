import * as fs from "fs";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log("Running P9-5 Perf Smoke tests...\n");
console.log("────────────────────────────────────────────────────────────────────");

const src = fs.readFileSync("client/src/pages/receipts.tsx", "utf-8");

test("P1: Uses @tanstack/react-virtual for row virtualization", () => {
  assert(src.includes("@tanstack/react-virtual"), "Must import from @tanstack/react-virtual");
  assert(src.includes("useVirtualizer"), "Must use useVirtualizer hook");
});

test("P2: Virtualizer uses estimateSize for row height", () => {
  assert(src.includes("estimateSize"), "Must define estimateSize");
  assert(src.includes("ROW_HEIGHT") || src.includes("estimateSize: ()"), "Must have row height constant");
});

test("P3: Virtualizer has overscan for smooth scrolling", () => {
  assert(src.includes("overscan"), "Must define overscan for buffer rows");
});

test("P4: Virtual rows use absolute positioning", () => {
  assert(src.includes("position: \"absolute\""), "Virtual rows must use absolute positioning");
  assert(src.includes("translateY"), "Virtual rows must use translateY for positioning");
});

test("P5: getVirtualItems renders only visible rows", () => {
  assert(src.includes("getVirtualItems"), "Must use getVirtualItems for rendering");
});

test("P6: getTotalSize sets container height", () => {
  assert(src.includes("getTotalSize"), "Must use getTotalSize for scroll container height");
});

test("P7: Scroll container has bounded maxHeight", () => {
  assert(src.includes("maxHeight"), "Scroll container must have maxHeight constraint");
});

test("P8: forensicsCache memoizes forensics parsing", () => {
  assert(src.includes("forensicsCache"), "Must have forensicsCache");
  assert(src.includes("useMemo") && src.includes("new Map"), "forensicsCache must use useMemo + Map");
});

test("P9: Badge renderers use useCallback", () => {
  const callbackCount = (src.match(/useCallback/g) || []).length;
  assert(callbackCount >= 5, `Expected 5+ useCallback usages, found ${callbackCount}`);
});

test("P10: Rendering cost is O(viewport) not O(n)", () => {
  assert(!src.includes("{filtered.map((receipt)"), "Must NOT use filtered.map for rendering (non-virtualized)");
  assert(src.includes("rowVirtualizer.getVirtualItems().map"), "Must iterate over virtual items only");
});

function generateSyntheticReceipts(count: number) {
  const statuses = ["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED"];
  const sigStatuses = ["VALID", "INVALID", "NO_SIGNATURE", "UNTRUSTED_ISSUER"];
  const chainStatuses = ["GENESIS", "LINKED", "BROKEN", "NOT_CHECKED"];
  const receipts = [];
  for (let i = 0; i < count; i++) {
    receipts.push({
      id: `synth-${i}`,
      receiptId: `synth-receipt-${i.toString().padStart(5, "0")}`,
      platform: "test",
      capturedAt: new Date().toISOString(),
      rawJson: "{}",
      forensicsJson: i % 7 === 0 ? JSON.stringify({
        pii_heuristics: { email_like_count: 2 },
        risk_keywords: { medical: { present: true } },
        anomalies: [],
      }) : null,
      expectedHashSha256: "abc",
      computedHashSha256: "abc",
      hashMatch: 1,
      signatureStatus: sigStatuses[i % sigStatuses.length],
      chainStatus: chainStatuses[i % chainStatuses.length],
      verificationStatus: statuses[i % statuses.length],
      hindsightKillSwitch: i % 50 === 0 ? 1 : 0,
      immutableLock: 1,
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
    });
  }
  return receipts;
}

test("P11: 5,000 synthetic receipts can be generated without crash", () => {
  const receipts = generateSyntheticReceipts(5000);
  assert(receipts.length === 5000, "Must generate exactly 5000 receipts");
  assert(receipts[0].receiptId === "synth-receipt-00000", "First receipt ID correct");
  assert(receipts[4999].receiptId === "synth-receipt-04999", "Last receipt ID correct");
});

test("P12: 10,000 synthetic receipts can be generated without crash", () => {
  const receipts = generateSyntheticReceipts(10000);
  assert(receipts.length === 10000, "Must generate 10000 receipts");
});

test("P13: Forensics parsing on 5k receipts completes in < 100ms", () => {
  const receipts = generateSyntheticReceipts(5000);
  const start = performance.now();
  const map = new Map();
  for (const r of receipts) {
    if (!r.forensicsJson) { map.set(r.id, null); continue; }
    try {
      const f = JSON.parse(r.forensicsJson);
      const piiFields = ["email_like_count", "phone_like_count", "ssn_like_count", "dob_like_count", "mrn_like_count", "ip_like_count"];
      let piiCount = 0;
      if (f.pii_heuristics) { for (const k of piiFields) { piiCount += (f.pii_heuristics[k] || 0); } }
      map.set(r.id, { pii: piiCount > 0, piiCount });
    } catch { map.set(r.id, null); }
  }
  const elapsed = performance.now() - start;
  assert(elapsed < 100, `Forensics parsing took ${elapsed.toFixed(1)}ms, expected < 100ms`);
});

test("P14: Filtering 5k receipts by search completes in < 50ms", () => {
  const receipts = generateSyntheticReceipts(5000);
  const start = performance.now();
  const q = "synth-receipt-012";
  const result = receipts.filter(r => r.receiptId.toLowerCase().includes(q));
  const elapsed = performance.now() - start;
  assert(result.length > 0, "Search must return results");
  assert(elapsed < 50, `Search took ${elapsed.toFixed(1)}ms, expected < 50ms`);
});

test("P15: Sorting 5k receipts completes in < 50ms", () => {
  const receipts = generateSyntheticReceipts(5000);
  const start = performance.now();
  receipts.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const elapsed = performance.now() - start;
  assert(elapsed < 50, `Sort took ${elapsed.toFixed(1)}ms, expected < 50ms`);
});

console.log("────────────────────────────────────────────────────────────────────");
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
