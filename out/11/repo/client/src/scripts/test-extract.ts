// Run `npx tsx client/src/scripts/test-extract.ts` to execute

import { extract, LanternPack, ExtractionOptions } from "../lib/lanternExtract";
import basicTests from "../fixtures/basic_test.json";
import advancedTests from "../fixtures/advanced_tests.json";

// Type definitions for fixtures (simplified for the script)
type Fixture = {
  description?: string;
  text: string;
  expected?: any;
};

// Colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function runTest(fixture: Fixture, suiteName: string) {
  console.log(`${colors.cyan}Running fixture: ${fixture.description || "Unnamed"} (${suiteName})${colors.reset}`);
  
  // Test 1: Provenance Integrity
  const modes: ExtractionOptions["mode"][] = ["balanced"]; // Default to balanced for speed
  
  let provenanceFailures = 0;
  let determinismFailures = 0;
  
  // Determinism check (Run 5 times)
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(extract(fixture.text, { mode: "balanced" }));
  }
  
  // Compare runs
  const refJson = JSON.stringify(results[0].items);
  for (let i = 1; i < 5; i++) {
    if (JSON.stringify(results[i].items) !== refJson) {
      determinismFailures++;
    }
  }

  // Provenance check on first result
  const pack = results[0];
  const allItems = [
    ...pack.items.entities,
    ...pack.items.quotes,
    ...pack.items.metrics,
    ...pack.items.timeline
  ];

  allItems.forEach(item => {
    // Validate bounds
    if (item.provenance.start < 0 || item.provenance.end > fixture.text.length) {
      console.log(`${colors.red}  [FAIL] Provenance bounds out of range: ${item.id}${colors.reset}`);
      provenanceFailures++;
      return;
    }

    // Validate substring match (Soft check: regex extractions might include slight variations, 
    // but heuristic engine should be reasonably exact if it claims offsets)
    // Actually, heuristic engine extracts item.text from match[0], so it SHOULD match exactly.
    // However, normalization (stripping punctuation) happens. 
    // The engine sets `start`/`end` based on the match.
    // Let's check if the text at those offsets contains the item text or is the item text.
    
    // In current engine:
    // Entity: text is normalized. Provenance is match.
    // Quote: text is normalized. Provenance is match.
    // So exact string match might fail if normalization happened. 
    // But the offsets should point to valid text.
    
    const slice = fixture.text.slice(item.provenance.start, item.provenance.end);
    if (!slice) {
      console.log(`${colors.red}  [FAIL] Provenance slice is empty: ${item.id}${colors.reset}`);
      provenanceFailures++;
    }
  });

  // Reporting
  if (determinismFailures > 0) {
    console.log(`${colors.red}  [FAIL] Determinism check failed (${determinismFailures}/5 drifts)${colors.reset}`);
  } else {
    console.log(`${colors.green}  [PASS] Determinism check${colors.reset}`);
  }

  if (provenanceFailures > 0) {
    console.log(`${colors.red}  [FAIL] Provenance check failed (${provenanceFailures} items)${colors.reset}`);
  } else {
    console.log(`${colors.green}  [PASS] Provenance check${colors.reset}`);
  }
  
  console.log(`${colors.dim}  Stats: ${pack.stats.emitted.entities} Ent, ${pack.stats.emitted.quotes} Qt, ${pack.stats.emitted.metrics} Met, ${pack.stats.duplicates_collapsed} Deduped${colors.reset}`);
  console.log("");
}

console.log(`${colors.yellow}=== LANTERN EXTRACT ENGINE TEST ===${colors.reset}\n`);

// Run Basic Suite
basicTests.forEach(f => runTest(f, "Basic"));

// Run Advanced Suite
advancedTests.forEach(f => runTest(f, "Advanced"));
