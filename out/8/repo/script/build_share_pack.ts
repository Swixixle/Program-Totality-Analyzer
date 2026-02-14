#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { logMilestone } from '../server/forensic-log';

const SHARE_PACK_DIR = path.join(process.cwd(), 'share_pack');
const FORENSIC_DIR = path.join(process.cwd(), 'forensic_state');
const SAMPLES_DIR = path.join(process.cwd(), 'samples');

const SYNTHETIC_ID_PATTERNS = [
  /^p\d+-/,
  /^test-/,
  /^sample-/,
  /^mock-/,
  /^synthetic-/,
];

const REDACTION_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /https?:\/\/[a-zA-Z0-9-]+\.replit\.app[^\s)"]*/gi, replacement: '[DEPLOYMENT_URL_REDACTED]' },
  { pattern: /https?:\/\/[a-zA-Z0-9-]+\.replit\.dev[^\s)"]*/gi, replacement: '[DEPLOYMENT_URL_REDACTED]' },
  { pattern: /https?:\/\/localhost:\d+[^\s)"]*/g, replacement: '[DEPLOYMENT_URL_REDACTED]' },
  { pattern: /https?:\/\/127\.0\.0\.1:\d+[^\s)"]*/g, replacement: '[DEPLOYMENT_URL_REDACTED]' },
  { pattern: /https?:\/\/0\.0\.0\.0:\d+[^\s)"]*/g, replacement: '[DEPLOYMENT_URL_REDACTED]' },
  { pattern: /replit\.com\/[^\s)"]*/gi, replacement: '[REPLIT_URL_REDACTED]' },
  { pattern: /\breplit\b/gi, replacement: '[PLATFORM_REDACTED]' },
  { pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '[IP_REDACTED]' },
  { pattern: /x-api-key:\s*["']?[a-zA-Z0-9-]+["']?/gi, replacement: 'x-api-key: [API_KEY_REDACTED]' },
  { pattern: /dev-test-key-\d+/g, replacement: '[API_KEY_REDACTED]' },
  { pattern: /OPENAI_API_KEY\s*=\s*[^\s]+/g, replacement: '[SECRET_REDACTED]' },
  { pattern: /OPENAI_API_KEY/g, replacement: '[SECRET_NAME_REDACTED]' },
  { pattern: /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC )?PRIVATE KEY-----/g, replacement: '[PRIVATE_KEY_REDACTED]' },
];

const FORBIDDEN_STRINGS = [
  '.replit.app',
  '.replit.dev',
  'replit.com',
  'OPENAI_API_KEY',
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN EC PRIVATE KEY',
];

const FORBIDDEN_CASE_INSENSITIVE = [
  'replit',
];

const FILES_EXEMPT_FROM_FORBIDDEN_CHECK = [
  'REDACTION_RULES.md',
  'INDEPENDENT_VERIFY.md',
];

const FORBIDDEN_PATTERNS = [
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

function isSyntheticId(id: string): boolean {
  return SYNTHETIC_ID_PATTERNS.some(p => p.test(id));
}

function redactReceiptIds(content: string): string {
  let result = content.replace(/"receipt_id"\s*:\s*"([^"]+)"/g, (match, id) => {
    if (isSyntheticId(id)) {
      return match;
    }
    return '"receipt_id": "[RECEIPT_ID_REDACTED]"';
  });
  
  result = result.replace(UUID_PATTERN, (match) => {
    if (isSyntheticId(match)) {
      return match;
    }
    return '[UUID_REDACTED]';
  });
  
  return result;
}

function applyRedactions(content: string): string {
  let result = content;
  
  for (const rule of REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  
  result = redactReceiptIds(result);
  
  return result;
}

function checkForbiddenStrings(content: string, filePath: string): string[] {
  const fileName = path.basename(filePath);
  if (FILES_EXEMPT_FROM_FORBIDDEN_CHECK.includes(fileName)) {
    return [];
  }
  
  const errors: string[] = [];
  
  for (const forbidden of FORBIDDEN_STRINGS) {
    if (content.includes(forbidden)) {
      if (forbidden === 'x-api-key' && content.includes('[API_KEY_REDACTED]')) {
        continue;
      }
      errors.push(`${filePath}: Contains forbidden string "${forbidden}"`);
    }
  }
  
  for (const forbidden of FORBIDDEN_CASE_INSENSITIVE) {
    const regex = new RegExp(`\\b${forbidden}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches) {
      const nonRedacted = matches.filter(m => !m.includes('REDACTED') && !m.includes('_REDACTED'));
      if (nonRedacted.length > 0) {
        errors.push(`${filePath}: Contains forbidden word "${forbidden}" (case-insensitive)`);
      }
    }
  }
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      if (match[0] === '[IP_REDACTED]') continue;
      errors.push(`${filePath}: Contains forbidden pattern (IP address: ${match[0]})`);
    }
  }
  
  return errors;
}

function copyAndRedact(srcDir: string, destDir: string, files: string[]): string[] {
  const errors: string[] = [];
  
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    
    if (!fs.existsSync(srcPath)) {
      console.log(`  Skipping ${file} (not found)`);
      continue;
    }
    
    const ext = path.extname(file).toLowerCase();
    const shouldRedact = ['.md', '.jsonl', '.txt', '.json'].includes(ext);
    
    if (shouldRedact) {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = applyRedactions(content);
      
      const fileErrors = checkForbiddenStrings(content, file);
      errors.push(...fileErrors);
      
      fs.writeFileSync(destPath, content);
      console.log(`  Copied and redacted: ${file}`);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${file}`);
    }
  }
  
  return errors;
}

async function main() {
  const checkOnly = process.argv.includes('--check-only');
  
  console.log('=== Building Share Pack ===\n');
  
  if (checkOnly) {
    console.log('Mode: Check only (no files will be created)\n');
  }
  
  if (!checkOnly) {
    if (fs.existsSync(SHARE_PACK_DIR)) {
      fs.rmSync(SHARE_PACK_DIR, { recursive: true });
    }
    fs.mkdirSync(SHARE_PACK_DIR, { recursive: true });
    fs.mkdirSync(path.join(SHARE_PACK_DIR, 'forensic_state'), { recursive: true });
    fs.mkdirSync(path.join(SHARE_PACK_DIR, 'samples'), { recursive: true });
  }
  
  const allErrors: string[] = [];
  
  console.log('1. Processing forensic_state files...');
  const forensicFiles = fs.readdirSync(FORENSIC_DIR).filter(f => 
    f.endsWith('.md') || f.endsWith('.jsonl') || f.endsWith('.txt')
  );
  
  if (!checkOnly) {
    const errors = copyAndRedact(
      FORENSIC_DIR, 
      path.join(SHARE_PACK_DIR, 'forensic_state'), 
      forensicFiles
    );
    allErrors.push(...errors);
  } else {
    for (const file of forensicFiles) {
      const content = fs.readFileSync(path.join(FORENSIC_DIR, file), 'utf8');
      const redacted = applyRedactions(content);
      const errors = checkForbiddenStrings(redacted, `forensic_state/${file}`);
      allErrors.push(...errors);
    }
  }
  
  console.log('\n2. Processing sample files...');
  const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter(f => 
    f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.txt')
  );
  
  if (!checkOnly) {
    const errors = copyAndRedact(
      SAMPLES_DIR, 
      path.join(SHARE_PACK_DIR, 'samples'), 
      sampleFiles
    );
    allErrors.push(...errors);
  } else {
    for (const file of sampleFiles) {
      const content = fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf8');
      const redacted = applyRedactions(content);
      const errors = checkForbiddenStrings(redacted, `samples/${file}`);
      allErrors.push(...errors);
    }
  }
  
  console.log('\n=== Build Complete ===\n');
  
  if (allErrors.length > 0) {
    console.log('ERRORS FOUND:');
    for (const error of allErrors) {
      console.log(`  - ${error}`);
    }
    console.log('\nBuild: FAILED');
    process.exit(1);
  }
  
  console.log('No forbidden strings detected');
  console.log('Build: SUCCESS');
  
  if (!checkOnly) {
    console.log(`\nShare pack created at: ${SHARE_PACK_DIR}`);
    
    logMilestone(
      'SHARE_PACK_BUILT',
      'Share pack built successfully with all redactions applied',
      ['share_pack/', 'forensic_state/SHARE_PACK.md']
    );
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
