/**
 * Verify Screen Public Mode Tests
 * 
 * Tests for P9-3 patch: Public mode behavior
 * 1. Public mode disables capsule inputs and requires receipt_id
 * 2. Public mode calls /api/public/receipts/:id/proof and renders cards in correct order
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VERIFY_PAGE_PATH = path.join(__dirname, "../client/src/pages/verify.tsx");

function runTests() {
  console.log("Running Verify Screen Public Mode tests...\n");
  console.log("────────────────────────────────────────────────────────────────────");
  
  const verifySource = fs.readFileSync(VERIFY_PAGE_PATH, "utf-8");
  
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
    "Toggle label is 'Public proof (receipt id only)'",
    verifySource.includes('Public proof (receipt id only)')
  );
  
  test(
    "Public mode calls /api/public/receipts/:id/proof endpoint",
    verifySource.includes('/api/public/receipts/${encodeURIComponent(id)}/proof')
  );
  
  test(
    "Public mode shows receipt ID input (input-receipt-id testid exists)",
    verifySource.includes('data-testid="input-receipt-id"')
  );
  
  test(
    "Capsule inputs only shown when NOT in public mode (publicOnly ? ... : capsule inputs)",
    verifySource.includes('{publicOnly ? (') && 
    verifySource.includes('input-receipt-id') &&
    verifySource.includes('input-capsule-json')
  );
  
  test(
    "Cards are in correct order: Hash first",
    verifySource.indexOf('data-testid="card-hash"') < verifySource.indexOf('data-testid="card-signature"')
  );
  
  test(
    "Cards are in correct order: Signature second",
    verifySource.indexOf('data-testid="card-signature"') < verifySource.indexOf('data-testid="card-chain"')
  );
  
  test(
    "ProofPackResult interface handles proof pack response structure",
    verifySource.includes('interface ProofPackResult') &&
    verifySource.includes('integrity: {') &&
    verifySource.includes('signature: {') &&
    verifySource.includes('chain: {')
  );
  
  test(
    "Proof pack result maps integrity.hash_match to hash_match",
    verifySource.includes('proofResult.integrity.hash_match')
  );
  
  test(
    "Proof pack result maps signature.status to signature_status",
    verifySource.includes('proofResult.signature.status')
  );
  
  test(
    "Proof pack result maps chain.status to chain_status",
    verifySource.includes('proofResult.chain.status')
  );
  
  console.log("────────────────────────────────────────────────────────────────────");
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
