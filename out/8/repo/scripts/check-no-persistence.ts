/**
 * CI check: Ensure no transcript persistence patterns in frontend code
 * 
 * Forbidden:
 * - localStorage / sessionStorage usage
 * - Known analytics SDK imports
 * - Session replay tools
 */

import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_PATTERNS = [
  { pattern: /localStorage\s*[.[]/, name: 'localStorage usage' },
  { pattern: /sessionStorage\s*[.[]/, name: 'sessionStorage usage' },
  { pattern: /window\.localStorage/, name: 'window.localStorage' },
  { pattern: /window\.sessionStorage/, name: 'window.sessionStorage' },
  { pattern: /from\s+['"]@segment/, name: 'Segment analytics' },
  { pattern: /from\s+['"]mixpanel/, name: 'Mixpanel analytics' },
  { pattern: /from\s+['"]amplitude/, name: 'Amplitude analytics' },
  { pattern: /from\s+['"]@fullstory/, name: 'FullStory session replay' },
  { pattern: /from\s+['"]@hotjar/, name: 'Hotjar session replay' },
  { pattern: /from\s+['"]logrocket/, name: 'LogRocket session replay' },
  { pattern: /gtag\s*\(/, name: 'Google Analytics gtag' },
  { pattern: /analytics\.track/, name: 'Analytics track call' },
  { pattern: /analytics\.identify/, name: 'Analytics identify call' },
];

// Allowed exceptions
const ALLOWED_PATTERNS = [
  /\/\/\s*@persistence-allowed/, // Explicit opt-in comment
  /check-no-persistence/,        // This file itself
];

const SCAN_DIRS = ['client/src'];
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

const EXCLUDE_PATTERNS = [
  /node_modules/,
];

interface Violation {
  file: string;
  line: number;
  pattern: string;
  context: string;
}

function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function isAllowedException(line: string): boolean {
  return ALLOWED_PATTERNS.some(pattern => pattern.test(line));
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (isAllowedException(line)) {
      return;
    }

    for (const { pattern, name } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: index + 1,
          pattern: name,
          context: line.trim().slice(0, 100),
        });
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

function main(): void {
  console.log('Scanning for persistence patterns in frontend code...\n');
  
  const allViolations: Violation[] = [];

  for (const dir of SCAN_DIRS) {
    allViolations.push(...scanDirectory(dir));
  }

  if (allViolations.length === 0) {
    console.log('No forbidden persistence patterns found.');
    process.exit(0);
  }

  console.log(`Found ${allViolations.length} violation(s):\n`);

  for (const v of allViolations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Pattern: ${v.pattern}`);
    console.log(`    Context: ${v.context}`);
    console.log('');
  }

  console.log('\nForbidden patterns:');
  for (const { name } of FORBIDDEN_PATTERNS) {
    console.log(`  - ${name}`);
  }
  console.log('\nSee docs/UI_NON_NEGOTIABLES.md for policy details.\n');

  process.exit(1);
}

main();
