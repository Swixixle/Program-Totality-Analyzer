/**
 * Static security checks for ci-worker.ts
 * 
 * These tests scan the source code to prevent regression of security issues:
 * - No shell: true in spawn calls
 * - No exec() usage (always use spawn with args array)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CI Worker Security - Static Analysis', () => {
  const ciWorkerPath = path.join(__dirname, '../ci-worker.ts');
  let ciWorkerSource: string;
  
  beforeAll(() => {
    ciWorkerSource = fs.readFileSync(ciWorkerPath, 'utf-8');
  });
  
  it('should never use shell: true in spawn calls', () => {
    // Check for any spawn calls with shell: true
    const shellTruePattern = /spawn\([^)]+\{[^}]*shell:\s*true/g;
    const matches = ciWorkerSource.match(shellTruePattern);
    
    if (matches) {
      expect(matches).toEqual([]);
      throw new Error(
        `SECURITY VIOLATION: Found shell: true in spawn calls:\n${matches.join('\n')}`
      );
    }
    
    expect(matches).toBeNull();
  });
  
  it('should have explicit shell: false in all spawn calls', () => {
    // Find all spawn calls (handle multi-line)
    const spawnPattern = /spawn\([^)]+,\s*\{[\s\S]*?\}\)/g;
    const spawnCalls = ciWorkerSource.match(spawnPattern);
    
    expect(spawnCalls).not.toBeNull();
    expect(spawnCalls!.length).toBeGreaterThan(0);
    
    // Each spawn call should have shell: false
    for (const call of spawnCalls!) {
      expect(call).toContain('shell: false');
    }
  });
  
  it('should never use exec() or execSync()', () => {
    // Check for dangerous exec functions
    const execPattern = /\b(exec|execSync)\s*\(/g;
    const matches = ciWorkerSource.match(execPattern);
    
    if (matches) {
      // Filter out false positives (like comments)
      const realMatches = matches.filter(m => {
        const index = ciWorkerSource.indexOf(m);
        const line = ciWorkerSource.substring(
          ciWorkerSource.lastIndexOf('\n', index),
          ciWorkerSource.indexOf('\n', index)
        );
        return !line.trim().startsWith('//') && !line.trim().startsWith('*');
      });
      
      if (realMatches.length > 0) {
        throw new Error(
          `SECURITY VIOLATION: Found exec() usage which can lead to shell injection:\n${realMatches.join('\n')}`
        );
      }
    }
    
    expect(matches).toBeNull();
  });
  
  it('should use spawn with args array pattern', () => {
    // Ensure spawn is called with separate args variable (not inline command strings)
    // Pattern matches: spawn(cmd, args, ...) or spawn(pythonBin, args, ...)
    const goodSpawnPattern = /spawn\(\s*\w+\s*,\s*[a-zA-Z_$][\w$]*/g;
    const matches = ciWorkerSource.match(goodSpawnPattern);
    
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThan(0);
  });
  
  it('should validate workdir paths', () => {
    // Ensure validateWorkdir function exists
    expect(ciWorkerSource).toContain('function validateWorkdir');
    expect(ciWorkerSource).toContain('validateWorkdir(');
  });
  
  it('should validate repo limits', () => {
    // Ensure validateRepoLimits function exists
    expect(ciWorkerSource).toContain('function validateRepoLimits');
    expect(ciWorkerSource).toContain('validateRepoLimits(');
  });
  
  it('should have repo size limit constants defined', () => {
    expect(ciWorkerSource).toContain('MAX_REPO_BYTES');
    expect(ciWorkerSource).toContain('MAX_FILE_COUNT');
    expect(ciWorkerSource).toContain('MAX_SINGLE_FILE_BYTES');
  });
});
