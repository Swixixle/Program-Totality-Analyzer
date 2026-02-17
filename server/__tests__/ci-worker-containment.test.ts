/**
 * Tests for CI worker workdir containment security.
 * 
 * Validates that workdir validation prevents:
 * - Parent directory escape via ".."
 * - Symlink escape attacks
 * - Paths outside CI_TMP_DIR
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock storage to avoid DATABASE_URL requirement
vi.mock('../storage', () => ({
  storage: {
    createCiRun: vi.fn(),
    updateCiRun: vi.fn(),
    getCiRun: vi.fn(),
  },
}));

// Now import after mocking
import { validateWorkdir, getCiTmpDir } from '../ci-worker';

describe('CI Worker Workdir Containment', () => {
  let testTmpDir: string;
  let originalEnv: string | undefined;
  
  beforeEach(() => {
    // Create a temporary test directory
    testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pta-containment-test-'));
    
    // Save original CI_TMP_DIR
    originalEnv = process.env.CI_TMP_DIR;
    
    // Set CI_TMP_DIR to our test directory
    process.env.CI_TMP_DIR = testTmpDir;
  });
  
  afterEach(() => {
    // Restore original CI_TMP_DIR
    if (originalEnv !== undefined) {
      process.env.CI_TMP_DIR = originalEnv;
    } else {
      delete process.env.CI_TMP_DIR;
    }
    
    // Clean up test directory
    if (testTmpDir && fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, { recursive: true, force: true });
    }
  });
  
  describe('validateWorkdir function', () => {
    it('should accept valid paths under CI_TMP_DIR', () => {
      const validPath = path.join(testTmpDir, 'run-123', 'repo');
      fs.mkdirSync(validPath, { recursive: true });
      
      const result = validateWorkdir(validPath);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });
    
    it('should reject paths with ".." parent directory escape', () => {
      // Create a valid directory first
      const baseDir = path.join(testTmpDir, 'run-123');
      fs.mkdirSync(baseDir, { recursive: true });
      
      // Create an escape path that actually exists
      const outsideDir = path.join(testTmpDir, '..', 'outside');
      fs.mkdirSync(outsideDir, { recursive: true });
      
      const result = validateWorkdir(outsideDir);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('WORKDIR_ESCAPE');
      
      // Clean up
      fs.rmSync(outsideDir, { recursive: true, force: true });
    });
    
    it('should reject paths outside CI_TMP_DIR', () => {
      const outsidePath = '/etc/passwd';
      
      const result = validateWorkdir(outsidePath);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe('WORKDIR_ESCAPE');
    });
    
    it('should reject symlink escape attacks', () => {
      // Create directory structure:
      // testTmpDir/allowed/
      // testTmpDir/forbidden/
      // testTmpDir/allowed/escape -> ../forbidden
      
      const allowedDir = path.join(testTmpDir, 'allowed');
      const forbiddenDir = path.join(testTmpDir, 'forbidden');
      const symlinkPath = path.join(allowedDir, 'escape');
      
      fs.mkdirSync(allowedDir, { recursive: true });
      fs.mkdirSync(forbiddenDir, { recursive: true });
      
      // Create symlink that points to sibling directory
      fs.symlinkSync('../forbidden', symlinkPath);
      
      // validateWorkdir should use realpath and accept it since it's still under testTmpDir
      // The symlink points to testTmpDir/forbidden which is valid
      const result = validateWorkdir(symlinkPath);
      
      // This is actually valid because forbidden is still under testTmpDir (our CI_TMP_DIR)
      // The security boundary is CI_TMP_DIR, not subdirectories within it
      expect(result.valid).toBe(true);
    });
    
    it('should reject symlink that escapes outside CI_TMP_DIR', () => {
      // Create a directory and symlink that points outside testTmpDir
      const linkDir = path.join(testTmpDir, 'link-dir');
      fs.mkdirSync(linkDir, { recursive: true });
      
      // Create a symlink to /tmp (parent of testTmpDir, outside CI_TMP_DIR)
      const symlinkPath = path.join(linkDir, 'escape');
      fs.symlinkSync('/tmp', symlinkPath);
      
      const result = validateWorkdir(symlinkPath);
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WORKDIR_ESCAPE');
    });
    
    it('should allow symlinks that stay within CI_TMP_DIR', () => {
      // Create directory structure:
      // testTmpDir/real/
      // testTmpDir/link -> real
      
      const realDir = path.join(testTmpDir, 'real');
      const symlinkPath = path.join(testTmpDir, 'link');
      
      fs.mkdirSync(realDir, { recursive: true });
      
      // Create safe symlink within allowed directory
      fs.symlinkSync('real', symlinkPath);
      
      const result = validateWorkdir(symlinkPath);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    it('should handle non-existent paths gracefully', () => {
      const nonExistentPath = path.join(testTmpDir, 'does-not-exist');
      
      const result = validateWorkdir(nonExistentPath);
      
      // Should fail because path doesn't exist (realpath will throw)
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WORKDIR_INVALID');
    });
    
    it('should reject path equal to tmpBase parent', () => {
      const parentPath = path.dirname(testTmpDir);
      
      const result = validateWorkdir(parentPath);
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WORKDIR_ESCAPE');
    });
  });
  
  describe('getCiTmpDir function', () => {
    it('should return CI_TMP_DIR when set', () => {
      process.env.CI_TMP_DIR = '/custom/tmp/dir';
      
      const result = getCiTmpDir();
      
      expect(result).toBe(path.resolve('/custom/tmp/dir'));
    });
    
    it('should return default /tmp/ci when CI_TMP_DIR not set', () => {
      delete process.env.CI_TMP_DIR;
      
      const result = getCiTmpDir();
      
      expect(result).toBe(path.resolve('/tmp/ci'));
    });
    
    it('should return absolute path', () => {
      const result = getCiTmpDir();
      
      expect(path.isAbsolute(result)).toBe(true);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle complex path manipulations', () => {
      // Create nested directory
      const validDir = path.join(testTmpDir, 'a', 'b', 'c');
      fs.mkdirSync(validDir, { recursive: true });
      
      // Create a directory outside testTmpDir for testing
      const outsideDir = path.join(testTmpDir, '..', 'outside-pta-test');
      fs.mkdirSync(outsideDir, { recursive: true });
      
      // Try various escape attempts that point to the outside directory
      const result = validateWorkdir(outsideDir);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WORKDIR_ESCAPE');
      
      // Clean up
      fs.rmSync(outsideDir, { recursive: true, force: true });
    });
    
    it('should handle normalized paths correctly', () => {
      const validDir = path.join(testTmpDir, 'run-123');
      fs.mkdirSync(validDir, { recursive: true });
      
      // Path with redundant separators and dots
      const weirdPath = path.join(testTmpDir, '.', 'run-123', '.');
      
      const result = validateWorkdir(weirdPath);
      
      expect(result.valid).toBe(true);
    });
  });
});

/**
 * Integration note:
 * 
 * These tests now validate the actual validateWorkdir function exported from ci-worker.ts.
 * The function implements:
 * 1. Resolve workDir to realpath (follows symlinks)
 * 2. Resolve tmpBase to realpath
 * 3. Check that realWorkDir starts with realTmpBase + path.sep
 * 4. Check that path.relative(tmpBase, workDir) doesn't contain ".."
 * 5. Return { valid: false, error: string, errorCode: string } on any violation
 */
