#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { verifyLogIntegrity, migrateExistingLog } from '../server/forensic-log';

const FORENSIC_DIR = path.join(process.cwd(), 'forensic_state');
const MANIFEST_PATH = path.join(FORENSIC_DIR, 'STATE_MANIFEST.md');
const LOG_PATH = path.join(FORENSIC_DIR, 'EVENT_LOG.jsonl');

function parseManifestTimestamp(content: string): string | null {
  const match = content.match(/## Last Updated\s*\n\s*(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/);
  return match ? match[1] : null;
}

function getLastEventTimestamp(): string | null {
  if (!fs.existsSync(LOG_PATH)) return null;
  
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  if (!content) return null;
  
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;
  
  try {
    const lastEvent = JSON.parse(lines[lines.length - 1]);
    return lastEvent.ts || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Forensic State Verification ===\n');
  
  let exitCode = 0;
  
  console.log('1. Checking if migration needed...');
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  const firstLine = content.split('\n')[0];
  try {
    const parsed = JSON.parse(firstLine);
    if (!parsed.line_hash) {
      console.log('   Legacy format detected, migrating...');
      const migration = migrateExistingLog();
      console.log(`   Migrated ${migration.migrated} lines`);
      if (migration.errors.length > 0) {
        console.log('   Migration warnings:', migration.errors);
      }
    } else {
      console.log('   Already in hash-chained format');
    }
  } catch {
    console.log('   Empty or invalid log, skipping migration');
  }
  
  console.log('\n2. Verifying EVENT_LOG.jsonl chain...');
  const result = verifyLogIntegrity();
  
  console.log(`   Lines verified: ${result.lineCount}`);
  console.log(`   Last hash: ${result.lastHash.substring(0, 16)}...`);
  
  if (result.valid) {
    console.log('   Chain integrity: VALID');
  } else {
    console.log('   Chain integrity: INVALID');
    console.log('   Errors:');
    for (const error of result.errors) {
      console.log(`     - ${error}`);
    }
    exitCode = 1;
  }
  
  console.log('\n3. Checking STATE_MANIFEST.md...');
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log('   STATE_MANIFEST.md not found');
    exitCode = 1;
  } else {
    const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifestTs = parseManifestTimestamp(manifestContent);
    const lastEventTs = getLastEventTimestamp();
    
    console.log(`   Manifest timestamp: ${manifestTs || 'not found'}`);
    console.log(`   Last event timestamp: ${lastEventTs || 'not found'}`);
    
    if (manifestTs && lastEventTs) {
      const manifestDate = new Date(manifestTs);
      const eventDate = new Date(lastEventTs);
      
      if (manifestDate >= eventDate) {
        console.log('   Timestamp check: PASS (manifest >= last event)');
      } else {
        console.log('   Timestamp check: WARN (manifest older than last event)');
      }
    }
    
    if (manifestContent.includes(result.lastHash.substring(0, 16))) {
      console.log('   Hash reference: FOUND in manifest');
    }
  }
  
  console.log('\n4. Checking required files...');
  const requiredFiles = [
    'STATE_MANIFEST.md',
    'EVENT_LOG.jsonl',
    'CAPABILITY_MATRIX.md',
    'EVIDENCE_POINTERS.md',
    'SHARE_PACK.md',
    'REDACTION_RULES.md',
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(FORENSIC_DIR, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ${file}: present`);
    } else {
      console.log(`   ${file}: MISSING`);
      exitCode = 1;
    }
  }
  
  console.log('\n=== Verification Complete ===');
  if (exitCode === 0) {
    console.log('Result: PASS');
  } else {
    console.log('Result: FAIL');
  }
  
  process.exit(exitCode);
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
