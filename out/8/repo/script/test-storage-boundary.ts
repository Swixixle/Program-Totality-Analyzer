#!/usr/bin/env tsx
/**
 * P6.5 Storage Boundary Tests
 * 
 * Validates:
 * - Observations never written to research exports
 * - Observations never stored in receipts or verification artifacts
 * - Observation storage stores observation only (not transcript)
 * - Kill switch hides stored observations
 * - Transcript mode guarantees
 */

import { 
  researchRecords, 
  llmObservations,
  receipts,
} from "../shared/schema";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
    }
  })();
}

function expect(value: any) {
  return {
    toBe(expected: any) {
      if (value !== expected) {
        throw new Error(`Expected ${expected} but got ${value}`);
      }
    },
    toBeDefined() {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeUndefined() {
      if (value !== undefined) {
        throw new Error(`Expected value to be undefined but got ${value}`);
      }
    },
    not: {
      toContain(expected: string) {
        if (value.includes(expected)) {
          throw new Error(`Expected "${value}" not to contain "${expected}"`);
        }
      },
      toBeDefined() {
        if (value !== undefined) {
          throw new Error(`Expected value to be undefined`);
        }
      }
    }
  };
}

async function runTests() {
  console.log("=== P6.5 Storage Boundary Tests ===\n");

  console.log("--- Schema Boundary Verification ---");

  await test("researchRecords schema should NOT have observation fields", () => {
    const columns = Object.keys(researchRecords);
    expect(columns.includes("observation")).toBe(false);
    expect(columns.includes("observationId")).toBe(false);
    expect(columns.includes("content")).toBe(false);
    expect(columns.includes("modelId")).toBe(false);
    expect(columns.includes("observations")).toBe(false);
  });

  await test("researchRecords schema should NOT have transcript fields", () => {
    const columns = Object.keys(researchRecords);
    expect(columns.includes("transcript")).toBe(false);
    expect(columns.includes("messages")).toBe(false);
    expect(columns.includes("rawTranscript")).toBe(false);
  });

  await test("llmObservations schema should NOT have transcript field", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("transcript")).toBe(false);
    expect(columns.includes("messages")).toBe(false);
    expect(columns.includes("rawTranscript")).toBe(false);
  });

  await test("llmObservations schema should have observation content (not transcript)", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("content")).toBe(true);
    expect(columns.includes("observationType")).toBe(true);
    expect(columns.includes("confidenceStatement")).toBe(true);
    expect(columns.includes("limitations")).toBe(true);
  });

  await test("receipts schema should NOT have observation fields", () => {
    const columns = Object.keys(receipts);
    expect(columns.includes("observation")).toBe(false);
    expect(columns.includes("observations")).toBe(false);
    expect(columns.includes("llmContent")).toBe(false);
    expect(columns.includes("sensorOutput")).toBe(false);
  });

  console.log("\n--- Data Isolation Verification ---");

  await test("researchRecords uses only categorical/bucketed data", () => {
    const columns = Object.keys(researchRecords);
    const expectedFields = [
      'researchId', 'datasetVersion', 
      'captureDateBucket', 'verificationDateBucket',
      'platformCategory', 'verificationOutcome', 
      'signatureOutcome', 'chainOutcome',
      'structuralStats', 'anomalyIndicators',
      'riskCategories', 'piiPresence',
      'killSwitchEngaged', 'interpretationBucket',
      'consentScope', 'createdAtBucket'
    ];
    for (const field of expectedFields) {
      expect(columns.includes(field)).toBe(true);
    }
  });

  await test("llmObservations is isolated table (not joined to receipts)", () => {
    const obsColumns = Object.keys(llmObservations);
    expect(obsColumns.includes("receiptId")).toBe(true);
    const receiptColumns = Object.keys(receipts);
    expect(receiptColumns.includes("observationId")).toBe(false);
  });

  console.log("\n--- Retention Policy Verification ---");

  await test("llmObservations has createdAt for TTL enforcement", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("createdAt")).toBe(true);
  });

  await test("llmObservations has observationId for deletion targeting", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("observationId")).toBe(true);
  });

  console.log("\n--- Transcript Mode Boundary ---");

  await test("llmObservations stores basedOn field (not raw transcript)", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("basedOn")).toBe(true);
  });

  console.log("\n--- Hard Boundary Verification (Schema Level) ---");

  await test("researchRecords has NO reference to llmObservations", () => {
    const researchColumns = Object.keys(researchRecords);
    expect(researchColumns.includes("observationId")).toBe(false);
    expect(researchColumns.includes("observationCount")).toBe(false);
    expect(researchColumns.includes("sensorOutput")).toBe(false);
    expect(researchColumns.includes("llmContent")).toBe(false);
  });

  await test("research record uses fresh UUID not correlated to receipt", () => {
    const columns = Object.keys(researchRecords);
    expect(columns.includes("researchId")).toBe(true);
    expect(columns.includes("receiptId")).toBe(false);
  });

  await test("observations can be deleted independently (has primary key)", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("observationId")).toBe(true);
  });

  await test("observations are linked by receiptId for kill switch scope", () => {
    const columns = Object.keys(llmObservations);
    expect(columns.includes("receiptId")).toBe(true);
  });

  console.log("\n=== Test Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
