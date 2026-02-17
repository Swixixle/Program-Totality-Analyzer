#!/usr/bin/env tsx
/**
 * TypeScript AST-based security checker for spawn calls.
 * 
 * This script parses ci-worker.ts using the TypeScript compiler API
 * and validates that all spawn() calls use shell: false.
 * 
 * This is more robust than regex checks as it handles:
 * - Multi-line spawn calls
 * - Comments
 * - Formatting variations
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: Security violations found
 * - 2: Script error
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SecurityViolation {
  type: 'missing_shell_false' | 'shell_true' | 'exec_usage';
  message: string;
  line: number;
  column: number;
}

const violations: SecurityViolation[] = [];

function checkSourceFile(sourceFile: ts.SourceFile) {
  function visit(node: ts.Node) {
    // Check for spawn calls
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      
      // Check if this is a spawn call
      if (ts.isIdentifier(expression) && expression.text === 'spawn') {
        checkSpawnCall(node, sourceFile);
      }
      
      // Check for dangerous exec functions
      if (ts.isIdentifier(expression)) {
        if (expression.text === 'exec' || expression.text === 'execSync') {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            type: 'exec_usage',
            message: `Dangerous ${expression.text}() usage found. Use spawn() with args array instead.`,
            line: line + 1,
            column: character + 1,
          });
        }
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
}

function checkSpawnCall(node: ts.CallExpression, sourceFile: ts.SourceFile) {
  // spawn(cmd, args, options)
  // We need to check if the options object has shell: false
  
  if (node.arguments.length < 3) {
    // Missing options argument - shell: false must be explicitly set
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    violations.push({
      type: 'missing_shell_false',
      message: 'spawn() call missing options argument with shell: false',
      line: line + 1,
      column: character + 1,
    });
    return;
  }
  
  const optionsArg = node.arguments[2];
  
  if (!ts.isObjectLiteralExpression(optionsArg)) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    violations.push({
      type: 'missing_shell_false',
      message: 'spawn() options argument is not an object literal',
      line: line + 1,
      column: character + 1,
    });
    return;
  }
  
  // Check for shell property
  let hasShellFalse = false;
  let hasShellTrue = false;
  
  for (const property of optionsArg.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name = property.name;
      if (ts.isIdentifier(name) && name.text === 'shell') {
        const initializer = property.initializer;
        
        if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
          hasShellFalse = true;
        } else if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
          hasShellTrue = true;
        }
      }
    }
  }
  
  if (hasShellTrue) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    violations.push({
      type: 'shell_true',
      message: 'CRITICAL: spawn() call has shell: true, which enables shell injection attacks',
      line: line + 1,
      column: character + 1,
    });
  } else if (!hasShellFalse) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    violations.push({
      type: 'missing_shell_false',
      message: 'spawn() call missing explicit shell: false in options',
      line: line + 1,
      column: character + 1,
    });
  }
}

function main() {
  const ciWorkerPath = path.join(__dirname, '..', 'server', 'ci-worker.ts');
  
  console.log('🔍 Checking spawn security in ci-worker.ts...\n');
  
  if (!fs.existsSync(ciWorkerPath)) {
    console.error(`❌ Error: File not found: ${ciWorkerPath}`);
    process.exit(2);
  }
  
  const sourceCode = fs.readFileSync(ciWorkerPath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    ciWorkerPath,
    sourceCode,
    ts.ScriptTarget.Latest,
    true
  );
  
  checkSourceFile(sourceFile);
  
  if (violations.length === 0) {
    console.log('✅ All spawn() calls are secure:');
    console.log('   - All spawn() calls have explicit shell: false');
    console.log('   - No exec() or execSync() usage found');
    console.log('');
    process.exit(0);
  } else {
    console.error('❌ Security violations found:\n');
    
    for (const violation of violations) {
      console.error(`  [Line ${violation.line}, Col ${violation.column}] ${violation.message}`);
    }
    
    console.error('');
    console.error('Fix these issues before committing. All spawn() calls must use shell: false.');
    console.error('Never use exec() or execSync() - always use spawn() with args array.');
    console.error('');
    process.exit(1);
  }
}

main();
