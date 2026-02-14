
import { segmentSentences } from '../lib/heuristics/segmenters/sentenceSegmenter';
import fixtures from '../fixtures/metric_and_attribution_edge_cases.json';

// --- TEST SUITE ---

const TESTS = [
  {
    name: "Standard Sentence",
    input: "Hello world. This is a test.",
    expected: ["Hello world.", "This is a test."]
  },
  {
    name: "Titles (Dr.)",
    input: "Dr. Smith went to the store.",
    expected: ["Dr. Smith went to the store."]
  },
  {
    name: "Commercial (Inc.)",
    input: "Apple Inc. reported earnings.",
    expected: ["Apple Inc. reported earnings."]
  },
  {
    name: "Geography (U.S.)",
    input: "The U.S. economy is strong.",
    expected: ["The U.S. economy is strong."]
  },
  {
    name: "Decimals / Currency",
    input: "The price is $3.50 per share. It rose 1.5%.",
    expected: ["The price is $3.50 per share.", "It rose 1.5%."]
  },
  {
    name: "Quotes (Terminal)",
    input: "\"I disagree.\" He said.",
    expected: ["\"I disagree.\"", "He said."]
  },
  {
    name: "Quotes (Mid-Sentence)",
    input: "He said \"hello\" to me.",
    expected: ["He said \"hello\" to me."]
  },
  {
    name: "Parentheses",
    input: "This is (very) cool. Indeed.",
    expected: ["This is (very) cool.", "Indeed."]
  },
  {
    name: "Parentheses with Punctuation",
    input: "I saw him (Dr. Smith) there.",
    expected: ["I saw him (Dr. Smith) there."]
  },
  {
    name: "Exclamation / Question",
    input: "Wow! Really? Yes.",
    expected: ["Wow!", "Really?", "Yes."]
  }
];

// --- RUNNER ---

function runTests() {
  console.log("=== RUNNING SENTENCE SEGMENTER TESTS ===");
  let passed = 0;
  let failed = 0;

  TESTS.forEach((t, i) => {
    const result = segmentSentences(t.input).map(s => s.text);
    const success = JSON.stringify(result) === JSON.stringify(t.expected);
    
    if (success) {
        passed++;
    } else {
        failed++;
        console.error(`\n[FAIL] ${t.name}`);
        console.error(`  Input:    ${t.input}`);
        console.error(`  Expected: ${JSON.stringify(t.expected)}`);
        console.error(`  Actual:   ${JSON.stringify(result)}`);
    }
  });

  console.log(`\nUnit Tests: ${passed}/${TESTS.length} passed.`);

  // --- REGRESSION METRICS ---
  console.log("\n=== FIXTURE REGRESSION METRICS ===");
  
  // We calculate stats on how many segments we produce for the known fixtures
  // Ideally we have "Ground Truth" for segments, but we don't.
  // So we report counts and some heuristics.
  
  let totalSegments = 0;
  let totalChars = 0;
  let shortSegments = 0; // Possible fragmentation noise
  
  fixtures.forEach((f: any) => {
      const segs = segmentSentences(f.text);
      totalSegments += segs.length;
      totalChars += f.text.length;
      segs.forEach(s => {
          if (s.text.length < 5) shortSegments++;
      });
  });

  console.log(`Total Fixtures: ${fixtures.length}`);
  console.log(`Total Segments: ${totalSegments}`);
  console.log(`Avg Segment Len: ${(totalChars / totalSegments).toFixed(1)} chars`);
  console.log(`Short Segments (<5 chars): ${shortSegments} (Noise Indicator)`);
}

runTests();
