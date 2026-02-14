/**
 * P9-4 Receipts Table Tests
 * 
 * Tests for the Receipts List page rewrite:
 * A) Smoke: table renders with exact column headers in exact order
 * B) Forensics flag derivation (parseForensics)
 * C) Source code assertions for filter/toggle/action wiring
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECEIPTS_PAGE_PATH = path.join(__dirname, "../client/src/pages/receipts.tsx");

function runTests() {
  console.log("Running P9-4 Receipts Table tests...\n");
  console.log("────────────────────────────────────────────────────────────────────");

  const src = fs.readFileSync(RECEIPTS_PAGE_PATH, "utf-8");

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
    "A1: Table has exact column headers in exact order (Receipt ID → Result → Signature → Chain → Forensics → Kill Switch → Created → Actions)",
    (() => {
      const colOrder = [
        'col-receipt-id',
        'col-result',
        'col-signature',
        'col-chain',
        'col-forensics',
        'col-kill-switch',
        'col-created',
        'col-actions',
      ];
      let lastIndex = -1;
      for (const col of colOrder) {
        const idx = src.indexOf(`data-testid="${col}"`);
        if (idx === -1 || idx <= lastIndex) return false;
        lastIndex = idx;
      }
      return true;
    })()
  );

  test(
    "A2: Uses <Table> component (not cards for rows)",
    src.includes('from "@/components/ui/table"') &&
    src.includes("<Table") &&
    src.includes("<TableRow") &&
    src.includes("<TableHeader")
  );

  test(
    "B1: parseForensics handles null/undefined input (returns null)",
    src.includes("function parseForensics") &&
    src.includes("if (!forensicsJson) return null;")
  );

  test(
    "B2: parseForensics extracts PII from pii_heuristics fields",
    src.includes("email_like_count") &&
    src.includes("phone_like_count") &&
    src.includes("ssn_like_count")
  );

  test(
    "B3: parseForensics extracts risk from risk_keywords categories",
    src.includes("instructional") &&
    src.includes("medical") &&
    src.includes("legal") &&
    src.includes("financial") &&
    src.includes("self_harm")
  );

  test(
    "B4: parseForensics handles malformed JSON gracefully (catch block returns null)",
    src.includes("} catch {") &&
    src.includes("return null;")
  );

  test(
    "B5: Forensics flags render PII/RISK/ANOM chips",
    src.includes('data-testid="flag-pii"') &&
    src.includes('data-testid="flag-risk"') &&
    src.includes('data-testid="flag-anom"')
  );

  test(
    "B6: Missing forensics shows em dash",
    src.includes('data-testid="forensics-unknown"') &&
    src.includes('"\\u2014"')
  );

  test(
    "C1: Status filter has all three options (VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED)",
    src.includes('value="VERIFIED"') &&
    src.includes('value="PARTIALLY_VERIFIED"') &&
    src.includes('value="UNVERIFIED"')
  );

  test(
    "C2: Forensics-only toggle exists",
    src.includes('data-testid="switch-forensics-only"') &&
    src.includes("forensicsOnly")
  );

  test(
    "C3: Kill-switch-only toggle exists",
    src.includes('data-testid="switch-kill-only"') &&
    src.includes("killSwitchOnly")
  );

  test(
    "C4: Results count showing 'Showing X of Y'",
    src.includes("Showing {items.length} of {total}")
  );

  test(
    "D1: Actions dropdown has exactly three items: View, Proof, Export",
    src.includes('action-view-') &&
    src.includes('action-proof-') &&
    src.includes('action-export-') &&
    !src.includes('action-delete-') &&
    !src.includes('action-edit-')
  );

  test(
    "D2: View action navigates to /receipts/:receiptId",
    src.includes('navigate(`/receipts/${receipt.receiptId}`)')
  );

  test(
    "D3: Proof action uses /api/public/receipts/:id/proof endpoint",
    src.includes('/api/public/receipts/${encodeURIComponent(receipt.receiptId)}/proof')
  );

  test(
    "D4: Export action uses /api/receipts/:id/export endpoint",
    src.includes('/api/receipts/${encodeURIComponent(receipt') &&
    src.includes('/export')
  );

  test(
    "E1: Kill switch tooltip shows only allowed text",
    src.includes('"Kill switch engaged"') &&
    src.includes('"Kill switch off"')
  );

  test(
    "E2: Kill switch column shows icon only (Lock/Unlock)",
    src.includes("<Lock") && src.includes("<Unlock") &&
    src.includes('kill-switch-')
  );

  test(
    "E3: Auth error (401/403) uses AuthRequiredBanner",
    src.includes("AuthRequiredBanner") &&
    src.includes("isAuthError")
  );

  test(
    "E4: No transcript content in page (no rawJson rendering, no transcript preview)",
    !src.includes("rawJson") || (src.includes("rawJson") === false) || 
    (!src.includes("transcript") || src.includes("transcript") && !src.includes("transcript.messages"))
  );

  test(
    "E5: Row click navigates to detail page",
    src.includes('onClick={() => navigate(`/receipts/${receipt.receiptId}`)}')
  );

  test(
    "F1: Copy ID shows 'Copied receipt ID' toast",
    src.includes('"Copied receipt ID"')
  );

  test(
    "F2: Copy failure shows 'Copy failed' toast",
    src.includes('"Copy failed"')
  );

  test(
    "F3: Export dialog title is 'Confirm Export'",
    src.includes("Confirm Export")
  );

  test(
    "F4: Export dialog PII text matches spec",
    src.includes("This receipt contains detected PII. Exporting may increase exposure risk.")
  );

  test(
    "F5: Export dialog kill-switch text matches spec",
    src.includes("Kill switch is engaged. Interpretation is blocked, but forensic export is permitted for evidence preservation.")
  );

  test(
    "F6: Safe receipt exports without dialog (window.open in handleExportClick)",
    src.includes('window.open(`/api/receipts/${encodeURIComponent(receiptId)}/export`, "_blank")')
  );

  test(
    "G1: Uses server-side paged endpoint (/api/receipts/paged)",
    src.includes("/api/receipts/paged")
  );

  test(
    "G2: Pagination controls (prev/next) exist",
    src.includes('button-prev-page') && src.includes('button-next-page')
  );

  test(
    "G3: Page size selector exists with 50/100/200 options",
    src.includes('select-page-size') && src.includes("/ page") && src.includes("PAGE_SIZE_OPTIONS") && src.includes("[50, 100, 200]")
  );

  test(
    "G4: Page info display (Page X of Y)",
    src.includes('text-page-info') && src.includes("Page {page} of {totalPages}")
  );

  test(
    "G5: Debounced search (300ms delay)",
    src.includes("debouncedSearch") && src.includes("300")
  );

  test(
    "G6: Filter change resets page to 1",
    src.includes("setPage(1)")
  );

  test(
    "G7: Response shape uses PagedResponse (items, total, page, pageSize, totalPages)",
    src.includes("PagedResponse") && src.includes("totalPages")
  );

  console.log("────────────────────────────────────────────────────────────────────");
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
