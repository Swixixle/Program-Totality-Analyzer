#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import { verifyBundle, ZipReader, ZipEntry } from "../shared/bundleVerify";

function createAdmZipReader(zipPath: string): ZipReader {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  return {
    async getEntries(): Promise<ZipEntry[]> {
      return entries.map((entry) => ({
        path: entry.entryName,
        async getData(): Promise<Buffer> {
          return entry.getData();
        },
      }));
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("Usage: node verify_bundle.js /path/to/bundle.zip [--strict=true|false]");
    process.exit(1);
  }

  const zipPath = args[0];
  let strict = true;

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--strict=")) {
      strict = arg.split("=")[1] !== "false";
    }
  }

  if (!fs.existsSync(zipPath)) {
    console.error(JSON.stringify({ error: `File not found: ${zipPath}` }));
    process.exit(1);
  }

  try {
    const reader = createAdmZipReader(zipPath);
    const result = await verifyBundle(reader, strict);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.bundle_ok ? 0 : 1);
  } catch (e) {
    console.error(JSON.stringify({ error: String(e) }));
    process.exit(1);
  }
}

main();
