#!/usr/bin/env tsx
import * as fs from 'fs';
import * as path from 'path';
import { verifyLogIntegrity } from '../server/forensic-log';

const FORENSIC_DIR = path.join(process.cwd(), 'forensic_state');
const SNAPSHOT_PATH = path.join(FORENSIC_DIR, 'SNAPSHOT.txt');
const LOG_PATH = path.join(FORENSIC_DIR, 'EVENT_LOG.jsonl');
const MANIFEST_PATH = path.join(FORENSIC_DIR, 'STATE_MANIFEST.md');

function parseCurrentPhase(manifestContent: string): string {
  const match = manifestContent.match(/## Current Phase\s*\n\s*(.+)/);
  return match ? match[1].trim() : 'Unknown';
}

function getTranscriptMode(): string {
  return process.env.TRANSCRIPT_MODE || 'full';
}

function countLogEvents(): { total: number; byType: Record<string, number> } {
  if (!fs.existsSync(LOG_PATH)) {
    return { total: 0, byType: {} };
  }
  
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  if (!content) {
    return { total: 0, byType: {} };
  }
  
  const lines = content.split('\n').filter(l => l.trim());
  const byType: Record<string, number> = {};
  
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const eventType = parsed.event_type || parsed.event || 'UNKNOWN';
      byType[eventType] = (byType[eventType] || 0) + 1;
    } catch {
      byType['PARSE_ERROR'] = (byType['PARSE_ERROR'] || 0) + 1;
    }
  }
  
  return { total: lines.length, byType };
}

function getKeyRegistryStats(): Record<string, number> {
  try {
    const keyRegistryPath = path.join(process.cwd(), 'server', 'key-registry.ts');
    if (!fs.existsSync(keyRegistryPath)) {
      return { ACTIVE: 0, REVOKED: 0, EXPIRED: 0 };
    }
    
    const content = fs.readFileSync(keyRegistryPath, 'utf8');
    
    const activeCount = (content.match(/status:\s*['"]ACTIVE['"]/g) || []).length;
    const revokedCount = (content.match(/status:\s*['"]REVOKED['"]/g) || []).length;
    const expiredCount = (content.match(/status:\s*['"]EXPIRED['"]/g) || []).length;
    
    return {
      ACTIVE: activeCount,
      REVOKED: revokedCount,
      EXPIRED: expiredCount,
    };
  } catch {
    return { ACTIVE: 0, REVOKED: 0, EXPIRED: 0 };
  }
}

function getRateLimitPolicies(): string[] {
  try {
    const rateLimiterPath = path.join(process.cwd(), 'server', 'rate-limiter.ts');
    if (!fs.existsSync(rateLimiterPath)) {
      return [];
    }
    
    const content = fs.readFileSync(rateLimiterPath, 'utf8');
    
    const policies: string[] = [];
    
    if (content.includes('public')) policies.push('public');
    if (content.includes('private')) policies.push('private');
    if (content.includes('verify')) policies.push('verify');
    if (content.includes('observe')) policies.push('observe');
    
    return policies.length > 0 ? policies : ['default'];
  } catch {
    return ['unknown'];
  }
}

async function main() {
  console.log('=== Generating State Snapshot ===\n');
  
  const manifestContent = fs.existsSync(MANIFEST_PATH) 
    ? fs.readFileSync(MANIFEST_PATH, 'utf8') 
    : '';
  
  const currentPhase = parseCurrentPhase(manifestContent);
  const transcriptMode = getTranscriptMode();
  const logEvents = countLogEvents();
  const keyStats = getKeyRegistryStats();
  const ratePolicies = getRateLimitPolicies();
  const logIntegrity = verifyLogIntegrity();
  
  const timestamp = new Date().toISOString();
  
  const snapshot = `# Forensic State Snapshot
Generated: ${timestamp}

## Current Phase
${currentPhase}

## Configuration
- TRANSCRIPT_MODE: ${transcriptMode}

## Event Log Statistics
- Total events: ${logEvents.total}
- Chain integrity: ${logIntegrity.valid ? 'VALID' : 'INVALID'}
- Last hash: ${logIntegrity.lastHash}

### Events by Type
${Object.entries(logEvents.byType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

## Key Registry
- ACTIVE keys: ${keyStats.ACTIVE}
- REVOKED keys: ${keyStats.REVOKED}
- EXPIRED keys: ${keyStats.EXPIRED}

## Rate Limit Policies
${ratePolicies.map(p => `- ${p}`).join('\n')}

## Verification
To verify this state:
\`\`\`bash
npm run forensic:verify
\`\`\`

## Hash Chain
Last line hash can be used to verify no tampering:
\`\`\`
${logIntegrity.lastHash}
\`\`\`
`;

  fs.writeFileSync(SNAPSHOT_PATH, snapshot);
  
  console.log('Snapshot generated:');
  console.log(`  Phase: ${currentPhase}`);
  console.log(`  Events: ${logEvents.total}`);
  console.log(`  Chain: ${logIntegrity.valid ? 'VALID' : 'INVALID'}`);
  console.log(`  Output: ${SNAPSHOT_PATH}`);
  
  console.log('\n=== Snapshot Complete ===');
}

main().catch(err => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});
