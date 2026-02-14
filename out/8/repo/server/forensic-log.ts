import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.join(process.cwd(), 'forensic_state', 'EVENT_LOG.jsonl');

export interface ForensicEvent {
  ts: string;
  event_type: string;
  summary: string;
  evidence_ptrs: string[];
  prev_line_hash: string;
  line_hash: string;
}

export interface ForensicEventInput {
  event_type: string;
  summary: string;
  evidence_ptrs?: string[];
}

function canonicalize(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

function computeLineHash(prevHash: string, lineWithoutHashes: Record<string, unknown>): string {
  const canonical = canonicalize(lineWithoutHashes);
  const input = prevHash + canonical;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function getLastLineHash(): string {
  if (!fs.existsSync(LOG_PATH)) {
    return 'GENESIS';
  }
  
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  if (!content) {
    return 'GENESIS';
  }
  
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    return 'GENESIS';
  }
  
  const lastLine = lines[lines.length - 1];
  try {
    const parsed = JSON.parse(lastLine);
    return parsed.line_hash || 'GENESIS';
  } catch {
    return 'GENESIS';
  }
}

export function appendEvent(input: ForensicEventInput): ForensicEvent {
  const prevHash = getLastLineHash();
  const ts = new Date().toISOString();
  
  const lineWithoutHashes: Record<string, unknown> = {
    ts,
    event_type: input.event_type,
    summary: input.summary,
    evidence_ptrs: input.evidence_ptrs || [],
  };
  
  const lineHash = computeLineHash(prevHash, lineWithoutHashes);
  
  const fullEvent: ForensicEvent = {
    ts,
    event_type: input.event_type,
    summary: input.summary,
    evidence_ptrs: input.evidence_ptrs || [],
    prev_line_hash: prevHash,
    line_hash: lineHash,
  };
  
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.appendFileSync(LOG_PATH, JSON.stringify(fullEvent) + '\n');
  
  return fullEvent;
}

export interface VerificationResult {
  valid: boolean;
  lineCount: number;
  errors: string[];
  lastHash: string;
}

export function verifyLogIntegrity(): VerificationResult {
  if (!fs.existsSync(LOG_PATH)) {
    return { valid: true, lineCount: 0, errors: [], lastHash: 'GENESIS' };
  }
  
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  if (!content) {
    return { valid: true, lineCount: 0, errors: [], lastHash: 'GENESIS' };
  }
  
  const lines = content.split('\n').filter(l => l.trim());
  const errors: string[] = [];
  let expectedPrevHash = 'GENESIS';
  let lastHash = 'GENESIS';
  
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let parsed: ForensicEvent;
    
    try {
      parsed = JSON.parse(lines[i]);
    } catch (e) {
      errors.push(`Line ${lineNum}: Invalid JSON`);
      continue;
    }
    
    if (parsed.prev_line_hash !== expectedPrevHash) {
      errors.push(`Line ${lineNum}: prev_line_hash mismatch. Expected ${expectedPrevHash}, got ${parsed.prev_line_hash}`);
    }
    
    const lineWithoutHashes: Record<string, unknown> = {
      ts: parsed.ts,
      event_type: parsed.event_type,
      summary: parsed.summary,
      evidence_ptrs: parsed.evidence_ptrs,
    };
    
    const computedHash = computeLineHash(parsed.prev_line_hash, lineWithoutHashes);
    if (computedHash !== parsed.line_hash) {
      errors.push(`Line ${lineNum}: line_hash mismatch. Expected ${computedHash}, got ${parsed.line_hash}`);
    }
    
    expectedPrevHash = parsed.line_hash;
    lastHash = parsed.line_hash;
  }
  
  return {
    valid: errors.length === 0,
    lineCount: lines.length,
    errors,
    lastHash,
  };
}

export function logMilestone(event_type: string, summary: string, evidence_ptrs: string[] = []): ForensicEvent {
  return appendEvent({ event_type, summary, evidence_ptrs });
}

export function migrateExistingLog(): { migrated: number; errors: string[] } {
  if (!fs.existsSync(LOG_PATH)) {
    return { migrated: 0, errors: [] };
  }
  
  const content = fs.readFileSync(LOG_PATH, 'utf8').trim();
  if (!content) {
    return { migrated: 0, errors: [] };
  }
  
  const lines = content.split('\n').filter(l => l.trim());
  const migratedLines: string[] = [];
  const errors: string[] = [];
  let prevHash = 'GENESIS';
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);
      
      if (parsed.line_hash && parsed.prev_line_hash) {
        migratedLines.push(lines[i]);
        prevHash = parsed.line_hash;
        continue;
      }
      
      const lineWithoutHashes: Record<string, unknown> = {
        ts: parsed.ts || parsed.timestamp || new Date().toISOString(),
        event_type: parsed.event_type || parsed.event || 'LEGACY_EVENT',
        summary: parsed.summary || parsed.details ? JSON.stringify(parsed.details) : 'Migrated from legacy format',
        evidence_ptrs: parsed.evidence_ptrs || [],
      };
      
      const lineHash = computeLineHash(prevHash, lineWithoutHashes);
      
      const migratedEvent: ForensicEvent = {
        ts: lineWithoutHashes.ts as string,
        event_type: lineWithoutHashes.event_type as string,
        summary: lineWithoutHashes.summary as string,
        evidence_ptrs: lineWithoutHashes.evidence_ptrs as string[],
        prev_line_hash: prevHash,
        line_hash: lineHash,
      };
      
      migratedLines.push(JSON.stringify(migratedEvent));
      prevHash = lineHash;
    } catch (e) {
      errors.push(`Line ${i + 1}: Failed to migrate - ${e}`);
    }
  }
  
  const backupPath = LOG_PATH + '.backup.' + Date.now();
  fs.copyFileSync(LOG_PATH, backupPath);
  
  fs.writeFileSync(LOG_PATH, migratedLines.join('\n') + '\n');
  
  return { migrated: migratedLines.length, errors };
}
