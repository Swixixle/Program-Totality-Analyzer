/**
 * Track B Receipt Detail Tests
 * 
 * Tests for operator hardening features:
 * 1. Risk Summary strip renders counts
 * 2. Missing forensics renders em dash
 * 3. Copy Receipt ID button exists with correct toast
 * 4. Proof Pack link has correct href pattern
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DETAIL_PAGE_PATH = path.join(__dirname, "../client/src/pages/receipt-detail.tsx");

function runTests() {
  console.log("Running Track B Receipt Detail tests...\n");
  console.log("────────────────────────────────────────────────────────────────────");

  const src = fs.readFileSync(DETAIL_PAGE_PATH, "utf-8");

  let passed = 0;
  let failed = 0;

  function test(name: string, condition: boolean) {
    if (condition) {
      console.log(`✓ ${name}`);
      passed++;
    } else {
      console.log(`✗ ${name}`);
      failed++;
    }
  }

  test(
    "1: Risk Summary strip exists with data-testid",
    src.includes('data-testid="risk-summary-strip"')
  );

  test(
    "2: Risk Summary renders PII/RISK/ANOM chips with counts",
    src.includes('data-testid="chip-pii"') &&
    src.includes('data-testid="chip-risk"') &&
    src.includes('data-testid="chip-anom"') &&
    src.includes("PII {riskSummary.piiCount}") &&
    src.includes("RISK {riskSummary.riskCount}") &&
    src.includes("ANOM {riskSummary.anomCount}")
  );

  test(
    "3: Missing forensics renders em dash",
    src.includes('data-testid="risk-summary-empty"') &&
    src.includes('"\\u2014"')
  );

  test(
    "4: Copy Receipt ID button exists with toast",
    src.includes('data-testid="button-copy-receipt-id"') &&
    src.includes('"Copied receipt ID"')
  );

  test(
    "5: Copy failure shows 'Copy failed' toast",
    src.includes('"Copy failed"')
  );

  test(
    "6: Proof Pack button exists with correct href pattern",
    src.includes('data-testid="button-open-proof-pack"') &&
    src.includes('/api/public/receipts/${encodeURIComponent(receipt.receiptId)}/proof') &&
    src.includes('target="_blank"') &&
    src.includes('rel="noreferrer"')
  );

  test(
    "7: Proof Pack button label is 'Open Proof Pack'",
    src.includes("Open Proof Pack")
  );

  test(
    "8: Risk summary computes PII count from pii_heuristics fields",
    src.includes("email_like_count") &&
    src.includes("phone_like_count") &&
    src.includes("ssn_like_count")
  );

  test(
    "9: Risk summary computes risk count from risk_keywords categories",
    src.includes("instructional") &&
    src.includes("medical") &&
    src.includes("self_harm")
  );

  test(
    "10: Risk summary computes anomaly count from anomalies array",
    src.includes("anomalies.length")
  );

  console.log("────────────────────────────────────────────────────────────────────");
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
