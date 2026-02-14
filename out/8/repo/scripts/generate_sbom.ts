import * as fs from "fs";
import * as path from "path";
import { getVersionInfo } from "../server/version";

const version = getVersionInfo();
const RELEASE_DIR = "releases";

function main() {
  console.log("Generating SBOM (CycloneDX 1.5) for verifier release...");

  fs.mkdirSync(RELEASE_DIR, { recursive: true });

  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [
          {
            type: "application",
            name: "ai-receipts-sbom-generator",
            version: version.semver,
          },
        ],
      },
      component: {
        type: "application",
        name: "ai-receipts-verifier",
        version: version.semver,
        description: "Standalone offline verifier for AI Receipts forensic packs",
        purl: `pkg:npm/ai-receipts-verifier@${version.semver}`,
        bom_ref: "ai-receipts-verifier",
      },
    },
    components: [
      {
        type: "library",
        name: "node-crypto",
        version: "builtin",
        description: "Node.js built-in crypto module (SHA-256, Ed25519)",
        scope: "required",
        bom_ref: "node-crypto",
        properties: [
          { name: "bundled", value: "true" },
          { name: "source", value: "Node.js runtime" },
        ],
      },
      {
        type: "library",
        name: "node-fs",
        version: "builtin",
        description: "Node.js built-in fs module (file I/O)",
        scope: "required",
        bom_ref: "node-fs",
        properties: [
          { name: "bundled", value: "true" },
          { name: "source", value: "Node.js runtime" },
        ],
      },
      {
        type: "library",
        name: "stableStringifyStrict",
        version: version.semver,
        description: "Deterministic JSON canonicalizer (embedded, no external dependency)",
        scope: "required",
        bom_ref: "stable-stringify-strict",
        properties: [
          { name: "bundled", value: "true" },
          { name: "source", value: "First-party, inlined in verify.js" },
        ],
      },
    ],
    dependencies: [
      {
        ref: "ai-receipts-verifier",
        dependsOn: ["node-crypto", "node-fs", "stable-stringify-strict"],
      },
    ],
    properties: [
      { name: "ai-receipts:commit", value: version.commit },
      { name: "ai-receipts:engineId", value: version.engineId },
      { name: "ai-receipts:signatureAlgorithm", value: version.signatureAlgorithm },
      { name: "ai-receipts:hashAlgorithm", value: "SHA-256" },
      { name: "ai-receipts:externalDependencies", value: "none" },
      { name: "ai-receipts:runtime", value: "Node.js >= 18" },
    ],
  };

  const sbomPath = path.join(RELEASE_DIR, "SBOM.json");
  fs.writeFileSync(sbomPath, JSON.stringify(sbom, null, 2));
  console.log(`SBOM written to: ${sbomPath}`);
  console.log(`  Components: ${sbom.components.length} (all bundled/builtin)`);
  console.log(`  External dependencies: 0`);
  console.log(`  Validate: npx @cyclonedx/cyclonedx-cli validate --input-file ${sbomPath}`);
}

main();
