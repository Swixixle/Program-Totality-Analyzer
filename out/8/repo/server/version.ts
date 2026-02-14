import { execSync } from "child_process";

const SEMVER = "0.2.0";

let cachedCommit: string | null = null;

function getCommitHash(): string {
  if (cachedCommit) return cachedCommit;
  try {
    cachedCommit = execSync("git rev-parse --short=12 HEAD", { encoding: "utf-8" }).trim();
  } catch {
    cachedCommit = "unknown";
  }
  return cachedCommit;
}

export function getVersionInfo() {
  return {
    semver: SEMVER,
    commit: getCommitHash(),
    auditPayloadVersion: 1,
    signatureAlgorithm: "Ed25519",
    engineId: `replit-node-verifier/${SEMVER}`,
  };
}
