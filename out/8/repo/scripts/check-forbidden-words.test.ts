/**
 * Unit tests for the forbidden-words scanner
 * 
 * Test A: "accurate" appears in any random UI string → scanner FAILS
 * Test B: "truth scoring" appears inside ForbiddenCapabilitiesList allowlist → scanner PASSES
 * 
 * Run with: npx tsx scripts/check-forbidden-words.test.ts
 */

import { testScanString } from './check-forbidden-words.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
  } catch (e) {
    results.push({ name, passed: false, error: (e as Error).message });
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

console.log('Running forbidden-words scanner tests...\n');

// Test A: "accurate" appears in any random UI string → scanner FAILS
test('Test A: "accurate" in random UI string should FAIL', () => {
  const code = `
    export function MyComponent() {
      return <div>This is accurate information</div>;
    }
  `;
  const violations = testScanString(code, 'client/src/components/my-component.tsx');
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].word).toBe('accurate');
});

test('Test A variant: "truth" in tooltip should FAIL', () => {
  const code = `
    <Tooltip>
      <TooltipContent>
        <p>This tells the truth about the data</p>
      </TooltipContent>
    </Tooltip>
  `;
  const violations = testScanString(code, 'client/src/components/tooltip.tsx');
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].word).toBe('truth');
});

test('Test A variant: "correct" in button label should FAIL', () => {
  const code = `
    <Button>Mark as correct</Button>
  `;
  const violations = testScanString(code, 'client/src/pages/home.tsx');
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].word).toBe('correct');
});

test('Test A variant: "hallucination" in error message should FAIL', () => {
  const code = `
    const errorMsg = "This response contains a hallucination";
  `;
  const violations = testScanString(code, 'client/src/utils/errors.ts');
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].word).toBe('hallucination');
});

// Test B: "truth scoring" appears inside ForbiddenCapabilitiesList allowlist → scanner PASSES
test('Test B: "Truth scoring" inside FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST should PASS', () => {
  const code = `
    export const FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST = [
      "LLM judgment",
      "Truth scoring",
      "Truth arbitration",
      "Model reconciliation",
    ];
  `;
  const violations = testScanString(code, 'client/src/ui/halo/forbidden-capabilities-list.tsx');
  expect(violations.length).toBe(0);
});

test('Test B variant: multiple forbidden terms in allowlist constant should PASS', () => {
  const code = `
    export const FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST = [
      "Truth scoring",
      "Truth arbitration",
    ];
  `;
  const violations = testScanString(code, 'client/src/ui/halo/forbidden-capabilities-list.tsx');
  expect(violations.length).toBe(0);
});

// Edge case: forbidden terms in ui/halo OUTSIDE the allowlist should FAIL
test('Edge case: forbidden term OUTSIDE allowlist in ui/halo should FAIL', () => {
  const code = `
    export const FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST = [
      "Truth scoring",
    ];
    
    export function SomeOtherComponent() {
      return <p>This is accurate</p>;
    }
  `;
  const violations = testScanString(code, 'client/src/ui/halo/other.tsx');
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0].word).toBe('accurate');
});

test('Edge case: "VERIFIED" in verification context should PASS', () => {
  const code = `
    case "VERIFIED":
      return <Badge>VERIFIED</Badge>;
  `;
  const violations = testScanString(code, 'client/src/components/status.tsx');
  expect(violations.length).toBe(0);
});

test('Edge case: boolean true/false in code should PASS', () => {
  const code = `
    const isEnabled = true;
    const isDisabled = false;
    return { enabled: true, disabled: false };
  `;
  const violations = testScanString(code, 'client/src/utils/config.ts');
  expect(violations.length).toBe(0);
});

test('Edge case: HTML attributes with forbidden substrings should PASS', () => {
  const code = `
    <div className="accurate-styling" data-testid="accurate-test">
      Content
    </div>
  `;
  const violations = testScanString(code, 'client/src/components/div.tsx');
  expect(violations.length).toBe(0);
});

// Print results
console.log('─'.repeat(60));
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

for (const result of results) {
  const icon = result.passed ? '✓' : '✗';
  console.log(`${icon} ${result.name}`);
  if (!result.passed && result.error) {
    console.log(`    Error: ${result.error}`);
  }
}

console.log('─'.repeat(60));
console.log(`\nTotal: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
