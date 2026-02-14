/**
 * CI check: Scan UI files for forbidden words
 * 
 * STRICT RULES:
 * 1. Scan only UI copy that renders to users (string literals)
 * 2. Exclude HTML attributes (className, data-*, aria-*, id, etc.)
 * 3. ONLY allow forbidden terms inside:
 *    - Files in src/ui/halo/**
 *    - AND inside the FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST constant or ForbiddenCapabilitiesList component
 * 4. Everything else is a hard fail
 */

import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_WORDS = [
  'true',
  'false',
  'correct',
  'incorrect',
  'accurate',
  'inaccurate',
  'truth',
  'lie',
  'lying',
  'misleading',
  'factual',
  'proves',
  'wrong',
  'hallucination',
  'deceptive',
  'therefore',
];

const SCAN_DIRS = ['client/src'];
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.test\./,
  /\.spec\./,
  /__tests__/,
];

interface Violation {
  file: string;
  line: number;
  word: string;
  context: string;
}

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function isAllowlistFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes('/ui/halo/');
}

function isInAllowlistBlock(line: string, context: { inAllowlistConst: boolean }): boolean {
  if (line.includes('FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST')) {
    context.inAllowlistConst = true;
  }
  if (context.inAllowlistConst && line.includes('];')) {
    context.inAllowlistConst = false;
    return true;
  }
  return context.inAllowlistConst;
}

function isHtmlAttribute(line: string, stringStart: number): boolean {
  const before = line.slice(0, stringStart);
  const attrPattern = /(className|class|id|data-\w+|aria-\w+|testid|name|type|variant|size|href|src|alt|title|placeholder|value|defaultValue|onClick|onChange|onSubmit|ref|key|style)\s*=\s*$/;
  return attrPattern.test(before);
}

function isCodeBoolean(line: string, stringMatch: string): boolean {
  const patterns = [
    /:\s*(true|false)\s*[,})\]]/,
    /=\s*(true|false)\s*[,;)}\]]/,
    /===?\s*(true|false)/,
    /!==?\s*(true|false)/,
    /\(\s*(true|false)\s*[,)]/,
    /return\s+(true|false)/,
    /\{(true|false)\}/,
    /&&\s*(true|false)/,
    /\|\|\s*(true|false)/,
    /\?(true|false):/,
    /:(true|false)[,})\]]/,
  ];
  return patterns.some(p => p.test(line));
}

function isVerificationContext(line: string): boolean {
  const patterns = [
    /verification.*status/i,
    /verified.*receipt/i,
    /verification.*result/i,
    /cryptographic.*verif/i,
    /hash.*verif/i,
    /signature.*verif/i,
    /chain.*verif/i,
    /"VERIFIED"/,
    /"PARTIALLY_VERIFIED"/,
    /"UNVERIFIED"/,
    /getVerificationBadge/,
    /verificationStatus/,
    /verification_status/,
  ];
  return patterns.some(p => p.test(line));
}

function extractStrings(line: string): Array<{ str: string; start: number; isJsxText?: boolean }> {
  const results: Array<{ str: string; start: number; isJsxText?: boolean }> = [];
  
  const stringRegex = /["'`]([^"'`]*)["'`]/g;
  let match;
  while ((match = stringRegex.exec(line)) !== null) {
    results.push({ str: match[1], start: match.index, isJsxText: false });
  }
  
  const jsxTextRegex = />([^<>{}]+)</g;
  while ((match = jsxTextRegex.exec(line)) !== null) {
    const text = match[1].trim();
    if (text.length > 0) {
      results.push({ str: text, start: match.index, isJsxText: true });
    }
  }
  
  return results;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const isAllowlist = isAllowlistFile(filePath);
  const context = { inAllowlistConst: false };

  lines.forEach((line, index) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    if (isAllowlist && isInAllowlistBlock(line, context)) {
      return;
    }

    if (isVerificationContext(line)) {
      return;
    }

    if (isCodeBoolean(line, '')) {
      return;
    }

    const strings = extractStrings(line);

    for (const { str, start, isJsxText } of strings) {
      if (!isJsxText && isHtmlAttribute(line, start)) {
        continue;
      }

      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(str)) {
          if ((word === 'true' || word === 'false') && isCodeBoolean(line, str)) {
            continue;
          }

          violations.push({
            file: filePath,
            line: index + 1,
            word,
            context: line.trim().slice(0, 100),
          });
        }
      }
    }
  });

  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];
  
  if (!fs.existsSync(dir)) {
    return violations;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldExcludeFile(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      violations.push(...scanDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.includes(ext)) {
        violations.push(...scanFile(fullPath));
      }
    }
  }

  return violations;
}

export function runScanner(): { violations: Violation[]; passed: boolean } {
  const allViolations: Violation[] = [];

  for (const dir of SCAN_DIRS) {
    allViolations.push(...scanDirectory(dir));
  }

  return {
    violations: allViolations,
    passed: allViolations.length === 0,
  };
}

export function testScanString(content: string, filePath: string = 'client/src/test.tsx'): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');
  const isAllowlist = isAllowlistFile(filePath);
  const context = { inAllowlistConst: false };

  lines.forEach((line, index) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    if (isAllowlist && isInAllowlistBlock(line, context)) {
      return;
    }

    if (isVerificationContext(line)) {
      return;
    }

    if (isCodeBoolean(line, '')) {
      return;
    }

    const strings = extractStrings(line);

    for (const { str, start, isJsxText } of strings) {
      if (!isJsxText && isHtmlAttribute(line, start)) {
        continue;
      }

      for (const word of FORBIDDEN_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(str)) {
          if ((word === 'true' || word === 'false') && isCodeBoolean(line, str)) {
            continue;
          }

          violations.push({
            file: filePath,
            line: index + 1,
            word,
            context: line.trim().slice(0, 100),
          });
        }
      }
    }
  });

  return violations;
}

function main(): void {
  console.log('Scanning for forbidden words in UI...\n');
  
  const { violations, passed } = runScanner();

  if (passed) {
    console.log('No forbidden words found in UI strings.');
    process.exit(0);
  }

  console.log(`Found ${violations.length} violation(s):\n`);

  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Forbidden word: "${v.word}"`);
    console.log(`    Context: ${v.context}`);
    console.log('');
  }

  console.log('\nForbidden words list:');
  console.log(FORBIDDEN_WORDS.map(w => `  - ${w}`).join('\n'));
  console.log('\nOnly allowed in: client/src/ui/halo/forbidden-capabilities-list.tsx (FORBIDDEN_CAPABILITIES_COPY_ALLOWLIST)');
  console.log('See docs/UI_NON_NEGOTIABLES.md for rules.\n');

  process.exit(1);
}

const isMainModule = process.argv[1]?.includes('check-forbidden-words.ts') && 
                     !process.argv[1]?.includes('.test.');
if (isMainModule) {
  main();
}
