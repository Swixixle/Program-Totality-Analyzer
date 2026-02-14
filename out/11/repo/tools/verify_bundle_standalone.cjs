#!/usr/bin/env node
const fs = require("fs");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

function computeManifestHash(manifest) {
  const canonical = {
    bundle_format: manifest.bundle_format,
    corpus_id: manifest.corpus_id,
    include_raw_sources: manifest.include_raw_sources,
    files: manifest.files,
    manifest_hash_alg: manifest.manifest_hash_alg,
  };
  const jsonStr = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(jsonStr, "utf8").digest("hex");
}

function computeSha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function isFilesSorted(files) {
  for (let i = 1; i < files.length; i++) {
    if (files[i].path.localeCompare(files[i - 1].path) < 0) {
      return false;
    }
  }
  return true;
}

function createAdmZipReader(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  return {
    async getEntries() {
      return entries.map((entry) => ({
        path: entry.entryName,
        async getData() {
          return entry.getData();
        },
      }));
    },
    async readText(entry) {
      const zipEntry = entries.find(e => e.entryName === entry.path);
      if (!zipEntry) throw new Error(`Entry not found: ${entry.path}`);
      return zipEntry.getData().toString("utf8");
    },
  };
}

async function verifyBundle(zipReader, strict = true) {
  const result = {
    bundle_ok: false,
    manifest_ok: false,
    manifest_hash_match: false,
    files_ok: false,
    include_raw_sources: false,
    raw_sources_ok: false,
    files_checked: 0,
    mismatches: [],
    extra_files: [],
    missing_files: [],
    notes: [],
    anchors_index_ok: null,
    anchors_index_checked: 0,
    anchors_index_mismatches: [],
    audit_summary_ok: null,
    audit_summary_issues: [],
    packet_index_ok: null,
    packet_index_checked: 0,
    packet_index_issues: [],
    snapshot_index_ok: null,
    snapshot_index_checked: 0,
    snapshot_index_issues: [],
    ledger_index_ok: null,
    ledger_index_checked: 0,
    ledger_index_issues: [],
  };

  const entries = await zipReader.getEntries();
  
  const manifestEntry = entries.find((e) => e.path.endsWith("/MANIFEST.json"));
  if (!manifestEntry) {
    result.notes.push("MANIFEST.json not found in bundle");
    return result;
  }

  const bundleRoot = manifestEntry.path.replace("MANIFEST.json", "");

  let manifest;
  try {
    const manifestData = await manifestEntry.getData();
    manifest = JSON.parse(manifestData.toString("utf8"));
    result.manifest_ok = true;
  } catch (e) {
    result.notes.push(`Failed to parse MANIFEST.json: ${e}`);
    return result;
  }

  result.include_raw_sources = manifest.include_raw_sources;

  const recomputedHash = computeManifestHash(manifest);
  result.manifest_hash_match = recomputedHash === manifest.manifest_hash_hex;
  if (!result.manifest_hash_match) {
    result.notes.push(
      `Manifest hash mismatch: expected ${manifest.manifest_hash_hex}, computed ${recomputedHash}`
    );
  }

  if (!isFilesSorted(manifest.files)) {
    result.notes.push("Manifest files[] is not lexicographically sorted by path");
  }

  const entryMap = new Map();
  for (const entry of entries) {
    if (entry.path.startsWith(bundleRoot) && entry.path !== bundleRoot) {
      const relativePath = entry.path.slice(bundleRoot.length);
      if (relativePath && !relativePath.endsWith("/")) {
        entryMap.set(relativePath, entry);
      }
    }
  }

  const manifestPaths = new Set(manifest.files.map((f) => f.path));
  manifestPaths.add("MANIFEST.json");

  for (const file of manifest.files) {
    const entry = entryMap.get(file.path);
    if (!entry) {
      result.missing_files.push(file.path);
    } else {
      const data = await entry.getData();
      const actualHash = computeSha256Hex(data);
      if (actualHash !== file.sha256_hex) {
        result.mismatches.push({
          path: file.path,
          expected_sha256: file.sha256_hex,
          actual_sha256: actualHash,
        });
      }
      result.files_checked++;
    }
  }

  result.files_ok =
    result.mismatches.length === 0 && result.missing_files.length === 0;

  const hasRawSourcesDir = Array.from(entryMap.keys()).some((p) =>
    p.startsWith("raw_sources/")
  );

  if (manifest.include_raw_sources) {
    result.raw_sources_ok = hasRawSourcesDir;
    if (!hasRawSourcesDir) {
      result.notes.push(
        "include_raw_sources=true but raw_sources/ directory not found"
      );
    }
  } else {
    result.raw_sources_ok = !hasRawSourcesDir;
    if (hasRawSourcesDir) {
      result.notes.push(
        "include_raw_sources=false but raw_sources/ directory exists"
      );
    }
  }

  if (strict) {
    for (const [relativePath] of entryMap) {
      if (relativePath === "MANIFEST.json") continue;
      if (manifestPaths.has(relativePath)) continue;
      if (
        manifest.include_raw_sources &&
        relativePath.startsWith("raw_sources/")
      ) {
        continue;
      }
      result.extra_files.push(relativePath);
    }
  }

  const anchorsIndexEntry = entryMap.get("anchors_proof_index.json");
  if (!anchorsIndexEntry) {
    result.anchors_index_ok = null;
    result.anchors_index_checked = 0;
    result.anchors_index_mismatches = [];
    // anchors_proof_index.json not present - null ok value is the signal
  } else {
    try {
      const anchorsIndexData = await anchorsIndexEntry.getData();
      const anchorsIndex = JSON.parse(anchorsIndexData.toString("utf8"));
      
      if (!anchorsIndex.corpus_id || !anchorsIndex.extractor || !anchorsIndex.anchors) {
        result.anchors_index_ok = false;
        result.notes.push("anchors_proof_index.json missing required top-level keys");
      } else if (anchorsIndex.extractor.name !== "pdfjs-text-v1" || anchorsIndex.extractor.version !== "1.0.0") {
        result.anchors_index_ok = false;
        result.notes.push(`anchors_proof_index.json extractor mismatch: expected pdfjs-text-v1@1.0.0, got ${anchorsIndex.extractor.name}@${anchorsIndex.extractor.version}`);
      } else if (!Array.isArray(anchorsIndex.anchors)) {
        result.anchors_index_ok = false;
        result.notes.push("anchors_proof_index.json anchors is not an array");
      } else {
        let sortedOk = true;
        for (let i = 1; i < anchorsIndex.anchors.length; i++) {
          if (anchorsIndex.anchors[i].anchor_id.localeCompare(anchorsIndex.anchors[i - 1].anchor_id) < 0) {
            sortedOk = false;
            result.anchors_index_mismatches.push({
              anchor_id: null,
              issue: "ANCHORS_NOT_SORTED",
              expected: null,
              actual: null,
              path: null
            });
            break;
          }
        }
        
        for (const anchor of anchorsIndex.anchors) {
          if (
            anchor.anchor_id === undefined ||
            anchor.source_id === undefined ||
            anchor.page_index === undefined ||
            anchor.quote_start_char === undefined ||
            anchor.quote_end_char === undefined ||
            anchor.page_text_sha256_hex === undefined
          ) {
            continue;
          }
          
          if (typeof anchor.page_index !== "number" || anchor.page_index < 0) {
            continue;
          }
          
          const pagePath = `pages/${anchor.source_id}/page-${anchor.page_index}.json`;
          const pageEntry = entryMap.get(pagePath);
          
          if (!pageEntry) {
            result.anchors_index_mismatches.push({
              anchor_id: anchor.anchor_id,
              issue: "PAGE_JSON_MISSING",
              expected: anchor.page_text_sha256_hex,
              actual: null,
              path: pagePath
            });
          } else {
            const pageData = await pageEntry.getData();
            const pageJson = JSON.parse(pageData.toString("utf8"));
            if (pageJson.page_text_sha256_hex !== anchor.page_text_sha256_hex) {
              result.anchors_index_mismatches.push({
                anchor_id: anchor.anchor_id,
                issue: "PAGE_TEXT_HASH_MISMATCH",
                expected: anchor.page_text_sha256_hex,
                actual: pageJson.page_text_sha256_hex,
                path: pagePath
              });
            }
          }
          
          result.anchors_index_checked++;
        }
        
        result.anchors_index_ok = sortedOk && result.anchors_index_mismatches.length === 0;
      }
    } catch (e) {
      result.anchors_index_ok = false;
      result.notes.push(`Failed to parse anchors_proof_index.json: ${e}`);
    }
  }

  const auditSummaryEntry = entryMap.get("audit_summary.json");
  if (!auditSummaryEntry) {
    result.audit_summary_ok = null;
    // audit_summary.json not present - null ok value is the signal
  } else {
    try {
      const auditData = await auditSummaryEntry.getData();
      const audit = JSON.parse(auditData.toString("utf8"));
      
      const requiredKeys = ["corpus_id", "sources", "pages", "anchors", "claims", "snapshots", "packets", "ledger_events", "extractor"];
      const auditKeys = Object.keys(audit);
      const hasAllKeys = requiredKeys.every(k => auditKeys.includes(k));
      const hasNoExtras = auditKeys.every(k => requiredKeys.includes(k));
      
      if (!hasAllKeys || !hasNoExtras) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_KEYS_INVALID");
      }
      
      const hasPagesInBundle = Array.from(entryMap.keys()).some(p => p.startsWith("pages/") && p.endsWith(".json"));
      
      if (hasPagesInBundle) {
        if (audit.extractor?.name !== "pdfjs-text-v1" || audit.extractor?.version !== "1.0.0") {
          result.audit_summary_issues.push("AUDIT_SUMMARY_EXTRACTOR_INVALID");
        }
      } else {
        if (audit.extractor?.name !== null || audit.extractor?.version !== null) {
          result.audit_summary_issues.push("AUDIT_SUMMARY_EXTRACTOR_INVALID");
        }
      }
      
      const isNonNegInt = (v) => typeof v === "number" && Number.isInteger(v) && v >= 0;
      let countsValid = true;
      
      if (!isNonNegInt(audit.sources?.count)) countsValid = false;
      if (!isNonNegInt(audit.pages?.count)) countsValid = false;
      if (!isNonNegInt(audit.anchors?.count)) countsValid = false;
      if (!isNonNegInt(audit.claims?.count)) countsValid = false;
      if (!isNonNegInt(audit.snapshots?.count)) countsValid = false;
      if (!isNonNegInt(audit.packets?.count)) countsValid = false;
      if (!isNonNegInt(audit.ledger_events?.count)) countsValid = false;
      
      if (audit.sources?.by_role) {
        for (const v of Object.values(audit.sources.by_role)) {
          if (!isNonNegInt(v)) countsValid = false;
        }
      }
      if (audit.anchors?.by_source_id) {
        for (const v of Object.values(audit.anchors.by_source_id)) {
          if (!isNonNegInt(v)) countsValid = false;
        }
      }
      if (audit.claims?.by_classification) {
        for (const v of Object.values(audit.claims.by_classification)) {
          if (!isNonNegInt(v)) countsValid = false;
        }
      }
      if (audit.ledger_events?.by_type) {
        for (const v of Object.values(audit.ledger_events.by_type)) {
          if (!isNonNegInt(v)) countsValid = false;
        }
      }
      
      if (!countsValid) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_COUNTS_INVALID");
      }
      
      let structureValid = true;
      if (typeof audit.sources?.by_role !== "object" || audit.sources?.by_role === null) structureValid = false;
      if (typeof audit.anchors?.by_source_id !== "object" || audit.anchors?.by_source_id === null) structureValid = false;
      if (typeof audit.claims?.by_classification !== "object" || audit.claims?.by_classification === null) structureValid = false;
      if (typeof audit.ledger_events?.by_type !== "object" || audit.ledger_events?.by_type === null) structureValid = false;
      
      if (!structureValid) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_STRUCTURE_INVALID");
      }
      
      const sumValues = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
      
      if (audit.sources?.count !== sumValues(audit.sources?.by_role)) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_SUM_MISMATCH");
      } else if (audit.anchors?.count !== sumValues(audit.anchors?.by_source_id)) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_SUM_MISMATCH");
      } else if (audit.claims?.count !== sumValues(audit.claims?.by_classification)) {
        result.audit_summary_issues.push("AUDIT_SUMMARY_SUM_MISMATCH");
      }
      
      result.audit_summary_ok = result.audit_summary_issues.length === 0;
    } catch (e) {
      result.audit_summary_ok = false;
      result.audit_summary_issues.push(`Failed to parse: ${e}`);
    }
  }

  const packetIndexEntry = entryMap.get("packet_proof_index.json");
  if (!packetIndexEntry) {
    result.packet_index_ok = null;
    result.packet_index_checked = 0;
    // packet_proof_index.json not present - null ok value is the signal
  } else {
    try {
      const packetIndexData = await packetIndexEntry.getData();
      const packetIndex = JSON.parse(packetIndexData.toString("utf8"));
      
      const requiredKeys = ["corpus_id", "packets"];
      const indexKeys = Object.keys(packetIndex);
      const hasAllKeys = requiredKeys.every(k => indexKeys.includes(k));
      const hasNoExtras = indexKeys.every(k => requiredKeys.includes(k));
      
      if (!hasAllKeys || !hasNoExtras) {
        result.packet_index_issues.push("PACKET_INDEX_KEYS_INVALID");
      }
      
      if (!Array.isArray(packetIndex.packets)) {
        result.packet_index_issues.push("PACKET_INDEX_PACKETS_NOT_ARRAY");
      } else {
        let sortedOk = true;
        for (let i = 1; i < packetIndex.packets.length; i++) {
          if (packetIndex.packets[i].packet_id.localeCompare(packetIndex.packets[i - 1].packet_id) < 0) {
            sortedOk = false;
            result.packet_index_issues.push("PACKET_INDEX_NOT_SORTED");
            break;
          }
        }
        
        const entryRequiredKeys = ["packet_id", "claim_id", "snapshot_id", "snapshot_hash_hex", "packet_hash_hex"];
        const is64Hex = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
        
        for (const pkt of packetIndex.packets) {
          const pktKeys = Object.keys(pkt);
          const hasAllEntryKeys = entryRequiredKeys.every(k => pktKeys.includes(k));
          const hasNoExtraEntryKeys = pktKeys.every(k => entryRequiredKeys.includes(k));
          
          if (!hasAllEntryKeys || !hasNoExtraEntryKeys) {
            if (!result.packet_index_issues.includes("PACKET_INDEX_ENTRY_KEYS_INVALID")) {
              result.packet_index_issues.push("PACKET_INDEX_ENTRY_KEYS_INVALID");
            }
          }
          
          if (!is64Hex(pkt.snapshot_hash_hex) || !is64Hex(pkt.packet_hash_hex)) {
            if (!result.packet_index_issues.includes("PACKET_INDEX_HASH_INVALID")) {
              result.packet_index_issues.push("PACKET_INDEX_HASH_INVALID");
            }
          }
          
          const snapshotPath = `snapshots/${pkt.snapshot_id}.json`;
          if (!entryMap.has(snapshotPath)) {
            if (!result.packet_index_issues.includes("PACKET_INDEX_SNAPSHOT_MISSING")) {
              result.packet_index_issues.push("PACKET_INDEX_SNAPSHOT_MISSING");
            }
          }
          
          result.packet_index_checked++;
        }
      }
      
      result.packet_index_ok = result.packet_index_issues.length === 0;
    } catch (e) {
      result.packet_index_ok = false;
      result.packet_index_issues.push(`Failed to parse: ${e}`);
    }
  }

  const snapshotIndexEntry = entryMap.get("snapshot_proof_index.json");
  if (!snapshotIndexEntry) {
    result.snapshot_index_ok = null;
    result.snapshot_index_checked = 0;
    // snapshot_proof_index.json not present - null ok value is the signal
  } else {
    try {
      const snapshotIndexData = await snapshotIndexEntry.getData();
      const snapshotIndex = JSON.parse(snapshotIndexData.toString("utf8"));
      
      const requiredKeys = ["corpus_id", "snapshots"];
      const indexKeys = Object.keys(snapshotIndex);
      const hasAllKeys = requiredKeys.every(k => indexKeys.includes(k));
      const hasNoExtras = indexKeys.every(k => requiredKeys.includes(k));
      
      if (!hasAllKeys || !hasNoExtras) {
        result.snapshot_index_issues.push("SNAPSHOT_INDEX_KEYS_INVALID");
      }
      
      if (!Array.isArray(snapshotIndex.snapshots)) {
        result.snapshot_index_issues.push("SNAPSHOT_INDEX_NOT_ARRAY");
      } else {
        for (let i = 1; i < snapshotIndex.snapshots.length; i++) {
          if (snapshotIndex.snapshots[i].snapshot_id.localeCompare(snapshotIndex.snapshots[i - 1].snapshot_id) < 0) {
            result.snapshot_index_issues.push("SNAPSHOT_INDEX_NOT_SORTED");
            break;
          }
        }
        
        const entryRequiredKeys = ["snapshot_id", "created_at", "hash_alg", "hash_hex"];
        const is64Hex = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
        
        for (const snap of snapshotIndex.snapshots) {
          const snapKeys = Object.keys(snap);
          const hasAllEntryKeys = entryRequiredKeys.every(k => snapKeys.includes(k));
          const hasNoExtraEntryKeys = snapKeys.every(k => entryRequiredKeys.includes(k));
          
          if (!hasAllEntryKeys || !hasNoExtraEntryKeys) {
            if (!result.snapshot_index_issues.includes("SNAPSHOT_INDEX_ENTRY_KEYS_INVALID")) {
              result.snapshot_index_issues.push("SNAPSHOT_INDEX_ENTRY_KEYS_INVALID");
            }
          }
          
          if (snap.hash_alg !== "SHA-256" || !is64Hex(snap.hash_hex)) {
            if (!result.snapshot_index_issues.includes("SNAPSHOT_INDEX_HASH_INVALID")) {
              result.snapshot_index_issues.push("SNAPSHOT_INDEX_HASH_INVALID");
            }
          }
          
          const snapshotPath = `snapshots/${snap.snapshot_id}.json`;
          if (!entryMap.has(snapshotPath)) {
            if (!result.snapshot_index_issues.includes("SNAPSHOT_INDEX_FILE_MISSING")) {
              result.snapshot_index_issues.push("SNAPSHOT_INDEX_FILE_MISSING");
            }
          }
          
          result.snapshot_index_checked++;
        }
      }
      
      result.snapshot_index_ok = result.snapshot_index_issues.length === 0;
    } catch (e) {
      result.snapshot_index_ok = false;
      result.snapshot_index_issues.push(`Failed to parse: ${e}`);
    }
  }

  // Validate ledger_proof_index.json
  const ledgerIndexEntry = entries.find((e) => e.path.endsWith("/ledger_proof_index.json"));
  if (!ledgerIndexEntry) {
    result.ledger_index_ok = null;
    // ledger_proof_index.json not present - null ok value is the signal
  } else {
    try {
      const ledgerIndexContent = await zipReader.readText(ledgerIndexEntry);
      const ledgerIndex = JSON.parse(ledgerIndexContent);
      
      // A) Required top-level keys (exact set)
      const ledgerIndexKeys = Object.keys(ledgerIndex).sort();
      if (ledgerIndexKeys.length !== 2 || ledgerIndexKeys[0] !== "corpus_id" || ledgerIndexKeys[1] !== "events") {
        result.ledger_index_issues.push("LEDGER_INDEX_KEYS_INVALID");
      } else if (!Array.isArray(ledgerIndex.events)) {
        // B) events is array
        result.ledger_index_issues.push("LEDGER_INDEX_NOT_ARRAY");
      } else {
        // C) Sorting
        for (let i = 1; i < ledgerIndex.events.length; i++) {
          if (ledgerIndex.events[i].event_id.localeCompare(ledgerIndex.events[i - 1].event_id) < 0) {
            result.ledger_index_issues.push("LEDGER_INDEX_NOT_SORTED");
            break;
          }
        }
        
        // Find ledger.json for cross-reference
        const ledgerJsonEntry = entries.find((e) => e.path.endsWith("/ledger.json"));
        let ledgerEventsMap = null;
        
        if (!ledgerJsonEntry) {
          result.ledger_index_issues.push("LEDGER_JSON_MISSING");
        } else {
          const ledgerJsonContent = await zipReader.readText(ledgerJsonEntry);
          const ledgerJson = JSON.parse(ledgerJsonContent);
          ledgerEventsMap = new Map();
          for (const ev of ledgerJson.events || []) {
            ledgerEventsMap.set(ev.event_id, ev);
          }
        }
        
        // D) Entry schema + hash validation + E) Cross-file existence + hash match
        const requiredEntryKeys = ["entity_id", "entity_type", "event_id", "event_type", "hash_alg", "hash_hex", "occurred_at"];
        
        for (const entry of ledgerIndex.events) {
          result.ledger_index_checked++;
          
          const entryKeys = Object.keys(entry).sort();
          if (entryKeys.length !== 7 || !requiredEntryKeys.every((k, i) => entryKeys[i] === k)) {
            if (!result.ledger_index_issues.includes("LEDGER_INDEX_ENTRY_KEYS_INVALID")) {
              result.ledger_index_issues.push("LEDGER_INDEX_ENTRY_KEYS_INVALID");
            }
          }
          
          if (entry.hash_alg !== "SHA-256" || !/^[0-9a-f]{64}$/.test(entry.hash_hex)) {
            if (!result.ledger_index_issues.includes("LEDGER_INDEX_HASH_INVALID")) {
              result.ledger_index_issues.push("LEDGER_INDEX_HASH_INVALID");
            }
          }
          
          // E) Cross-file checks
          if (ledgerEventsMap) {
            const ledgerEvent = ledgerEventsMap.get(entry.event_id);
            if (!ledgerEvent) {
              if (!result.ledger_index_issues.includes("LEDGER_INDEX_EVENT_MISSING")) {
                result.ledger_index_issues.push("LEDGER_INDEX_EVENT_MISSING");
              }
            } else if (ledgerEvent.hash_hex !== entry.hash_hex) {
              if (!result.ledger_index_issues.includes("LEDGER_INDEX_HASH_MISMATCH")) {
                result.ledger_index_issues.push("LEDGER_INDEX_HASH_MISMATCH");
              }
            }
          }
        }
      }
      
      result.ledger_index_ok = result.ledger_index_issues.length === 0;
    } catch (e) {
      result.ledger_index_ok = false;
      result.ledger_index_issues.push(`Failed to parse: ${e}`);
    }
  }

  result.bundle_ok =
    result.manifest_ok &&
    result.manifest_hash_match &&
    result.files_ok &&
    result.raw_sources_ok &&
    result.extra_files.length === 0 &&
    (result.anchors_index_ok === null || result.anchors_index_ok === true) &&
    (result.audit_summary_ok === null || result.audit_summary_ok === true) &&
    (result.packet_index_ok === null || result.packet_index_ok === true) &&
    (result.snapshot_index_ok === null || result.snapshot_index_ok === true) &&
    (result.ledger_index_ok === null || result.ledger_index_ok === true);

  return result;
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
