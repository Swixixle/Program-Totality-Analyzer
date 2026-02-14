import * as fs from "fs";

const src = fs.readFileSync("client/src/lib/apiFetch.ts", "utf-8");

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

console.log("Running apiFetch contract tests...\n");
console.log("────────────────────────────────────────────────────────────────────");

test("C1: No hardcoded API keys in apiFetch", () => {
  assert(!src.includes("dev-test-key"), "Found hardcoded dev test key");
  assert(!src.includes("12345"), "Found hardcoded key fragment");
});

test("C2: Only reads key from import.meta.env.VITE_DEV_API_KEY", () => {
  assert(src.includes("env.VITE_DEV_API_KEY"), "Must read from env.VITE_DEV_API_KEY");
  const keyRefs = (src.match(/VITE_DEV_API_KEY/g) || []).length;
  assert(keyRefs >= 1, "Must reference VITE_DEV_API_KEY at least once");
});

test("C3: isDevLike guards all injection logic", () => {
  assert(src.includes("isDevLike"), "Must use isDevLike guard");
  assert(src.includes('env.DEV'), "Must check env.DEV");
  assert(src.includes('"test"'), 'Must check mode === "test"');
  assert(src.includes('"e2e"'), 'Must check mode === "e2e"');
});

test("C4: No injection for /api/public/** endpoints", () => {
  assert(src.includes('!url.startsWith("/api/public/")'), "Must exclude /api/public/ from injection");
});

test("C5: isPrivateApi correctly scoped", () => {
  assert(src.includes('url.startsWith("/api/")'), "Must match /api/ prefix");
  assert(src.includes('!url.startsWith("/api/public/")'), "Must exclude public endpoints");
});

test("C6: E2E mode throws on missing key (exact string)", () => {
  assert(
    src.includes('throw new Error("Missing VITE_DEV_API_KEY (required for E2E private API calls)")'),
    "Must throw exact E2E error message"
  );
});

test("C7: Dev/test mode warns once (module-level flag)", () => {
  assert(src.includes("warnedMissingKey") || src.includes("_warnedMissingKey"), "Must have module-level warning flag");
  assert(src.includes("console.warn"), "Must use console.warn in dev/test");
});

test("C8: No production injection (isDevLike gates everything)", () => {
  const injectionBlock = src.match(/if\s*\(isDevLike\s*&&\s*isPrivateApi\)/);
  assert(!!injectionBlock, "Injection must be gated by isDevLike && isPrivateApi");
});

test("C9: Header only set when not already present", () => {
  assert(src.includes('headers.has("x-api-key")'), "Must check if header already exists");
});

test("C10: Warn message matches spec", () => {
  assert(
    src.includes("Missing VITE_DEV_API_KEY. Set it in Replit Secrets (dev/test) to access private endpoints."),
    "Warn message must match spec exactly"
  );
});

console.log("────────────────────────────────────────────────────────────────────");
console.log(`\nTotal: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
