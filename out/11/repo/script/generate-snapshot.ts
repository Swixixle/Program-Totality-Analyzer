#!/usr/bin/env tsx
/**
 * Snapshot Generator for Nikodemus/Lantern
 * 
 * Generates a safe, reviewable snapshot of system state.
 * Excludes secrets, Canon content, and protected parameters.
 * 
 * Usage: npx tsx script/generate-snapshot.ts
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const SNAPSHOT_DIR = "docs/snapshots";
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "CURRENT_SNAPSHOT.md");

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "(command failed)";
  }
}

function getGitInfo(): { hash: string; branch: string; timestamp: string } {
  return {
    hash: run("git rev-parse --short HEAD"),
    branch: run("git branch --show-current"),
    timestamp: new Date().toISOString(),
  };
}

const DENYLIST_PATTERNS = [
  "EXTRACTION_ENGINE",
  "QUALITY_CONTRACT", 
  "CANON",
  "FORMULA",
  "THRESHOLD",
  "PROTECTED",
  "PRIVATE",
  "SECRET",
  ".env",
];

function isFileSafe(filePath: string): boolean {
  const upperPath = filePath.toUpperCase();
  for (const pattern of DENYLIST_PATTERNS) {
    if (upperPath.includes(pattern.toUpperCase())) {
      return false;
    }
  }
  return true;
}

function getRepoTree(): string {
  try {
    const allFiles = run(`find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \\) 2>/dev/null | grep -v node_modules | grep -v ".git/" | grep -v dist/ | grep -v ".cache/" | grep -v ".local/" | grep -v ".upm/" | grep -v "attached_assets/" | sort`);
    
    const safeFiles = allFiles
      .split("\n")
      .filter((f) => f.trim() && isFileSafe(f))
      .join("\n");
    
    return safeFiles || "(no safe files found)";
  } catch {
    return "(tree generation failed)";
  }
}

function getDependencies(): { prod: string[]; dev: string[] } {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    return {
      prod: Object.keys(pkg.dependencies || {}),
      dev: Object.keys(pkg.devDependencies || {}),
    };
  } catch {
    return { prod: [], dev: [] };
  }
}

function getRoutes(): string[] {
  const routes: string[] = [];
  
  try {
    const routesFile = fs.readFileSync("server/routes.ts", "utf-8");
    const matches = routesFile.matchAll(/app\.(get|post|put|delete|patch)\s*\(\s*["'`]([^"'`]+)["'`]/g);
    for (const match of matches) {
      routes.push(`${match[1].toUpperCase()} ${match[2]}`);
    }
  } catch {}
  
  return routes;
}

function getClientPages(): string[] {
  const pages: string[] = [];
  
  try {
    const files = fs.readdirSync("client/src/pages");
    for (const file of files) {
      if (file.endsWith(".tsx")) {
        pages.push(file.replace(".tsx", ""));
      }
    }
  } catch {}
  
  return pages;
}

function getHeuristicEntrypoints(): string[] {
  const entrypoints: string[] = [];
  
  try {
    const heuristicsDir = "client/src/lib/heuristics";
    if (fs.existsSync(heuristicsDir)) {
      const walkDir = (dir: string, prefix = "") => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath, `${prefix}${item}/`);
          } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
            entrypoints.push(`${prefix}${item}`);
          }
        }
      };
      walkDir(heuristicsDir);
    }
  } catch {}
  
  return entrypoints;
}

function getSchemaInfo(): string[] {
  const schemas: string[] = [];
  
  try {
    const schemaDir = "client/src/lib/schema";
    if (fs.existsSync(schemaDir)) {
      const files = fs.readdirSync(schemaDir);
      for (const file of files) {
        if (file.endsWith(".ts")) {
          schemas.push(file);
        }
      }
    }
  } catch {}
  
  try {
    if (fs.existsSync("shared/schema.ts")) {
      schemas.push("shared/schema.ts (Drizzle)");
    }
  } catch {}
  
  return schemas;
}

function generateSnapshot(): string {
  const git = getGitInfo();
  const deps = getDependencies();
  const routes = getRoutes();
  const pages = getClientPages();
  const heuristics = getHeuristicEntrypoints();
  const schemas = getSchemaInfo();
  
  const tree = getRepoTree()
    .split("\n")
    .filter((line) => {
      return !line.includes("attached_assets") &&
             !line.includes(".local") &&
             !line.includes(".upm") &&
             !line.includes(".cache");
    })
    .join("\n");

  return `# Nikodemus System Snapshot

Generated: ${git.timestamp}
Commit: ${git.hash}
Branch: ${git.branch}

---

## Framework & Runtime

- **Runtime**: Node.js (tsx for dev, node for prod)
- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Express 5
- **Storage**: Browser IndexedDB via idb (local-first architecture)
- **Build**: Vite (client) + esbuild (server)

---

## Repository Structure

\`\`\`
${tree}
\`\`\`

---

## Dependencies

### Production (${deps.prod.length})
${deps.prod.map((d) => `- ${d}`).join("\n")}

### Development (${deps.dev.length})
${deps.dev.map((d) => `- ${d}`).join("\n")}

---

## API Routes

${routes.length > 0 ? routes.map((r) => `- \`${r}\``).join("\n") : "- No API routes defined (client-heavy architecture)"}

---

## Client Pages

${pages.map((p) => `- ${p}`).join("\n")}

---

## Heuristic Entrypoints

${heuristics.length > 0 ? heuristics.map((h) => `- heuristics/${h}`).join("\n") : "- (none found)"}

---

## Schema Definitions

${schemas.length > 0 ? schemas.map((s) => `- ${s}`).join("\n") : "- (none found)"}

---

## Governance Documents

- UX_GOVERNANCE.md
- SYSTEM_MAP.md
- LANTERN_CORE_BOUNDARY.md
- docs/investor/*.md

---

## Excluded from Snapshot (Security)

The following are explicitly excluded:
- \`attached_assets/\` — User uploads, potentially sensitive
- \`.local/\` — Local state, may contain tokens
- \`.cache/\` — Build cache
- \`node_modules/\` — Dependencies (use package.json)
- \`dist/\` — Build output
- \`.git/\` — Git internals
- \`.env\`, \`.env.*\` — Environment variables/secrets
- Any file containing "Canon", "formula", "threshold" values

---

## Verification

To verify this snapshot is current:
\`\`\`bash
git rev-parse --short HEAD
# Should match: ${git.hash}
\`\`\`

To regenerate:
\`\`\`bash
npx tsx script/generate-snapshot.ts
\`\`\`

---

*This snapshot is safe for external review. It contains structure and wiring only — no secrets, protected parameters, or Canon content.*
`;
}

function main() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
  
  const snapshot = generateSnapshot();
  fs.writeFileSync(SNAPSHOT_FILE, snapshot);
  
  console.log(`Snapshot generated: ${SNAPSHOT_FILE}`);
  console.log(`Commit: ${run("git rev-parse --short HEAD")}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
}

main();
