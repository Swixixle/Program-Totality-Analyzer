import type { Message, ForensicsResult } from "@shared/schema";

const FORENSICS_ENGINE_ID = "detectors/0.1.0";

interface MessageWithTimestamp extends Message {
  timestamp?: string;
}

export function computeForensics(
  messages: MessageWithTimestamp[],
  hashMatch: boolean,
  verificationStatus: "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED"
): ForensicsResult {
  const anomalies: ForensicsResult["anomalies"] = [];

  // Add integrity failure anomaly if hash mismatch
  if (!hashMatch) {
    anomalies.push({
      code: "INTEGRITY_FAILED",
      severity: "HIGH",
      message: "Computed hash does not match expected hash. Content may be tampered or incomplete.",
    });
  }

  // C1) Transcript Stats
  const transcript_stats = computeTranscriptStats(messages, anomalies);

  // C2) Timestamp Checks
  const timestamp_checks = computeTimestampChecks(messages, anomalies);

  // C3) Content Signals
  const content_signals = computeContentSignals(messages, anomalies);

  // C4) Risk Keywords (Heuristic)
  const risk_keywords = computeRiskKeywords(messages, anomalies);

  // C5) PII Heuristics
  const pii_heuristics = computePiiHeuristics(messages);

  // C6) Structural Anomalies
  const structural_anomalies = computeStructuralAnomalies(messages, anomalies);

  // Determine based_on: only "verified_transcript" if integrity passed
  const based_on: ForensicsResult["based_on"] = 
    verificationStatus === "UNVERIFIED" ? "submitted_payload" : "verified_transcript";

  return {
    schema: "ai-receipt/forensics/1.0",
    forensics_engine_id: FORENSICS_ENGINE_ID,
    forensics_ran_at: new Date().toISOString(),
    detectors_ran: [
      "transcript_stats",
      "timestamp_checks",
      "content_signals",
      "risk_keywords",
      "pii_heuristics",
      "structural_anomalies",
    ],
    based_on,
    integrity_context: verificationStatus,
    transcript_stats,
    timestamp_checks,
    content_signals,
    risk_keywords,
    pii_heuristics,
    structural_anomalies,
    anomalies,
  };
}

function normalizeRole(role: string): "user" | "assistant" | "system" | "tool" | "other" {
  const lower = role.toLowerCase();
  if (lower === "user") return "user";
  if (lower === "assistant") return "assistant";
  if (lower === "system") return "system";
  if (lower === "tool") return "tool";
  return "other";
}

function computeTranscriptStats(
  messages: MessageWithTimestamp[],
  anomalies: ForensicsResult["anomalies"]
): ForensicsResult["transcript_stats"] {
  const roles = { user: 0, assistant: 0, system: 0, tool: 0, other: 0 };
  const chars_by_role = { user: 0, assistant: 0, system: 0, tool: 0, other: 0 };
  let chars_total = 0;
  let max_message_chars = 0;
  let max_message_role = "assistant";

  for (const msg of messages) {
    const normalizedRole = normalizeRole(msg.role);
    roles[normalizedRole]++;

    const contentLen = msg.content?.length ?? 0;
    chars_total += contentLen;
    chars_by_role[normalizedRole] += contentLen;

    if (contentLen > max_message_chars) {
      max_message_chars = contentLen;
      max_message_role = normalizedRole;
    }

    // Check for empty content
    if (!msg.content || msg.content.length === 0) {
      anomalies.push({
        code: "EMPTY_MESSAGE",
        severity: "LOW",
        message: `Empty content in ${normalizedRole} message`,
      });
    }

    // Check for unknown role
    if (normalizedRole === "other") {
      anomalies.push({
        code: "UNKNOWN_ROLE",
        severity: "LOW",
        message: `Unknown role: ${msg.role}`,
      });
    }
  }

  const message_count = messages.length;
  const avg_chars_per_message = message_count > 0 ? Math.floor(chars_total / message_count) : 0;

  return {
    message_count,
    roles,
    chars_total,
    chars_by_role,
    avg_chars_per_message,
    max_message_chars,
    max_message_role,
  };
}

function computeTimestampChecks(
  messages: MessageWithTimestamp[],
  anomalies: ForensicsResult["anomalies"]
): ForensicsResult["timestamp_checks"] {
  const notes: string[] = [];
  let present = false;
  let missing_count = 0;
  let non_iso_count = 0;
  let non_monotonic_count = 0;

  const isoRegex = /^\d{4}-\d{2}-\d{2}T/;
  let lastValidTimestamp: number | null = null;

  for (const msg of messages) {
    if (msg.timestamp) {
      present = true;

      // Check ISO format
      const isIso = isoRegex.test(msg.timestamp);
      const parsed = Date.parse(msg.timestamp);
      const isValidDate = !isNaN(parsed);

      if (!isIso || !isValidDate) {
        non_iso_count++;
      }

      // Check monotonicity
      if (isValidDate && lastValidTimestamp !== null) {
        if (parsed < lastValidTimestamp) {
          non_monotonic_count++;
        }
      }

      if (isValidDate) {
        lastValidTimestamp = parsed;
      }
    } else {
      missing_count++;
    }
  }

  if (missing_count > 0 && present) {
    notes.push(`timestamps missing on ${missing_count}/${messages.length} messages`);
  }

  if (non_iso_count > 0) {
    notes.push(`${non_iso_count} non-ISO timestamp(s) detected`);
    anomalies.push({
      code: "NON_ISO_TIMESTAMPS",
      severity: "MEDIUM",
      message: `${non_iso_count} timestamp(s) do not match ISO 8601 format`,
    });
  }

  if (non_monotonic_count > 0) {
    notes.push(`${non_monotonic_count} non-monotonic timestamp(s) detected`);
    anomalies.push({
      code: "NON_MONOTONIC_TIMESTAMPS",
      severity: "MEDIUM",
      message: `${non_monotonic_count} timestamp(s) are out of chronological order`,
    });
  }

  return {
    present,
    missing_count,
    non_iso_count,
    non_monotonic_count,
    notes,
  };
}

function computeContentSignals(
  messages: MessageWithTimestamp[],
  anomalies: ForensicsResult["anomalies"]
): ForensicsResult["content_signals"] {
  let code_fence_count = 0;
  let url_count = 0;
  let newline_count_total = 0;
  let non_printable_char_count = 0;
  let high_entropy_block_count = 0;

  const urlRegex = /https?:\/\/\S+/g;
  const codeFenceRegex = /```/g;
  const nonPrintableRegex = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
  
  // High entropy detection configuration
  // Method: Pattern matching for base64-like contiguous alphanumeric blocks
  // Rationale: Base64 encoding produces long sequences of [A-Za-z0-9+/] with optional = padding
  // min_block_length: 80 chars - shorter blocks are common in normal text (variable names, etc.)
  // This is NOT Shannon entropy calculation - it's a pattern-based heuristic for encoded data
  // High-entropy-like pattern detection (NOT Shannon entropy calculation)
  // Detects base64-like contiguous alphanumeric blocks that may indicate encoded data
  const HIGH_ENTROPY_MIN_BLOCK_LENGTH = 80;
  const HIGH_ENTROPY_PATTERN = "[A-Za-z0-9+/]{80,}={0,2}";
  const highEntropyRegex = new RegExp(HIGH_ENTROPY_PATTERN, "g");

  for (const msg of messages) {
    const content = msg.content ?? "";

    // Count code fences
    const fenceMatches = content.match(codeFenceRegex);
    code_fence_count += fenceMatches?.length ?? 0;

    // Count URLs
    const urlMatches = content.match(urlRegex);
    url_count += urlMatches?.length ?? 0;

    // Count newlines
    newline_count_total += (content.match(/\n/g) ?? []).length;

    // Count non-printable chars
    const nonPrintMatches = content.match(nonPrintableRegex);
    non_printable_char_count += nonPrintMatches?.length ?? 0;

    // Count high entropy blocks (base64-like patterns)
    const entropyMatches = content.match(highEntropyRegex);
    high_entropy_block_count += entropyMatches?.length ?? 0;
  }

  if (high_entropy_block_count > 0) {
    anomalies.push({
      code: "HIGH_ENTROPY_BLOCK",
      severity: "MEDIUM",
      message: `${high_entropy_block_count} high-entropy block(s) detected (possible encoded data)`,
    });
  }

  return {
    code_fence_count,
    url_count,
    newline_count_total,
    non_printable_char_count,
    high_entropy_block_count,
    high_entropy_config: {
      method: "pattern_match_base64_like",
      description: "Pattern matching for base64-like contiguous alphanumeric sequences (NOT Shannon entropy)",
      min_block_length: HIGH_ENTROPY_MIN_BLOCK_LENGTH,
      pattern: HIGH_ENTROPY_PATTERN,
    },
  };
}

function computeRiskKeywords(
  messages: MessageWithTimestamp[],
  anomalies: ForensicsResult["anomalies"]
): ForensicsResult["risk_keywords"] {
  const allContent = messages.map((m) => m.content ?? "").join(" ");

  // Heuristic keyword patterns - these detect presence of keywords, NOT content classification
  const instructionalRegex =
    /\b(do|follow|steps|step|click|run|execute|install|configure|must|should|need to)\b/gi;
  const medicalRegex =
    /\b(dose|dosage|mg|mcg|prescribe|diagnos|symptom|treatment|contraindicat|ventilator|oxygen|ABG)\b/gi;
  const legalRegex =
    /\b(lawsuit|liable|attorney|legal advice|statute|contract|jurisdiction)\b/gi;
  const financialRegex =
    /\b(wire|transfer|bank|routing|account number|ACH|payment|invoice|crypto|send money)\b/gi;
  const selfHarmRegex = /\b(suicide|kill myself|self harm)\b/gi;

  const instructionalMatches = allContent.match(instructionalRegex) ?? [];
  const medicalMatches = allContent.match(medicalRegex) ?? [];
  const legalMatches = allContent.match(legalRegex) ?? [];
  const financialMatches = allContent.match(financialRegex) ?? [];
  const selfHarmMatches = allContent.match(selfHarmRegex) ?? [];

  if (selfHarmMatches.length > 0) {
    anomalies.push({
      code: "SELF_HARM_LANGUAGE",
      severity: "HIGH",
      message: "Self-harm language pattern matched (heuristic). Not a diagnosis.",
    });
  }

  return {
    instructional: {
      present: instructionalMatches.length > 0,
      count: instructionalMatches.length,
    },
    medical: {
      present: medicalMatches.length > 0,
      count: medicalMatches.length,
    },
    legal: {
      present: legalMatches.length > 0,
      count: legalMatches.length,
    },
    financial: {
      present: financialMatches.length > 0,
      count: financialMatches.length,
    },
    self_harm: {
      present: selfHarmMatches.length > 0,
      count: selfHarmMatches.length,
    },
  };
}

function computePiiHeuristics(
  messages: MessageWithTimestamp[]
): ForensicsResult["pii_heuristics"] {
  const allContent = messages.map((m) => m.content ?? "").join(" ");
  const notes: string[] = [];

  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const phoneRegex = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  const dobRegex = /\b(19|20)\d{2}[-\/](0[1-9]|1[0-2])[-\/](0[1-9]|[12]\d|3[01])\b/g;
  const mrnRegex = /\bMRN[:\s]?\d{6,10}\b/gi;
  const ipRegex = /\b\d{1,3}(\.\d{1,3}){3}\b/g;

  const email_like_count = (allContent.match(emailRegex) ?? []).length;
  const phone_like_count = (allContent.match(phoneRegex) ?? []).length;
  const ssn_like_count = (allContent.match(ssnRegex) ?? []).length;
  const dob_like_count = (allContent.match(dobRegex) ?? []).length;
  const mrn_like_count = (allContent.match(mrnRegex) ?? []).length;
  const ip_like_count = (allContent.match(ipRegex) ?? []).length;

  const total = email_like_count + phone_like_count + ssn_like_count + dob_like_count + mrn_like_count + ip_like_count;

  if (total > 0) {
    notes.push("Potential identifier patterns detected (heuristic). Not confirmed PII.");
  }

  return {
    email_like_count,
    phone_like_count,
    ssn_like_count,
    dob_like_count,
    mrn_like_count,
    ip_like_count,
    notes,
  };
}

const OVERSIZE_THRESHOLD_CHARS = 50000;
const EXPECTED_ROLES = ["user", "assistant", "system", "tool"];

function computeStructuralAnomalies(
  messages: MessageWithTimestamp[],
  globalAnomalies: ForensicsResult["anomalies"]
): ForensicsResult["structural_anomalies"] {
  const anomalies: ForensicsResult["structural_anomalies"]["anomalies"] = [];
  
  let missing_role_count = 0;
  let empty_content_count = 0;
  let unexpected_role_count = 0;
  let duplicate_message_count = 0;
  let oversize_message_count = 0;

  const seenMessages = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // MISSING_ROLE: role is undefined, null, or empty string
    if (!msg.role || msg.role.trim() === "") {
      missing_role_count++;
      anomalies.push({
        code: "MISSING_ROLE",
        severity: "HIGH",
        message: "Missing or empty role",
        index: i,
        observed: { role: msg.role ?? "" },
      });
    } else {
      // UNEXPECTED_ROLE: role is not in expected set
      const normalizedRole = msg.role.toLowerCase().trim();
      if (!EXPECTED_ROLES.includes(normalizedRole)) {
        unexpected_role_count++;
        anomalies.push({
          code: "UNEXPECTED_ROLE",
          severity: "MEDIUM",
          message: "Unexpected role",
          index: i,
          observed: { role: msg.role },
        });
      }
    }

    // EMPTY_CONTENT: content is undefined, null, or empty string
    if (!msg.content || msg.content.trim() === "") {
      empty_content_count++;
      anomalies.push({
        code: "EMPTY_CONTENT",
        severity: "LOW",
        message: "Empty content",
        index: i,
        observed: { content_length: 0 },
      });
    }

    // OVERSIZE_MESSAGE: content exceeds threshold
    const contentLength = msg.content?.length ?? 0;
    if (contentLength > OVERSIZE_THRESHOLD_CHARS) {
      oversize_message_count++;
      anomalies.push({
        code: "OVERSIZE_MESSAGE",
        severity: "MEDIUM",
        message: "Content exceeds size threshold",
        index: i,
        observed: { content_length: contentLength, threshold: OVERSIZE_THRESHOLD_CHARS },
      });
    }

    // DUPLICATE_MESSAGE: exact duplicate of role+content
    const msgKey = `${msg.role?.toLowerCase() ?? ""}:${msg.content ?? ""}`;
    if (seenMessages.has(msgKey)) {
      duplicate_message_count++;
      anomalies.push({
        code: "DUPLICATE_MESSAGE",
        severity: "LOW",
        message: "Duplicate message",
        index: i,
        observed: { role: msg.role },
      });
    } else {
      seenMessages.add(msgKey);
    }
  }

  // Add summary to global anomalies if any structural issues found
  const totalIssues = missing_role_count + empty_content_count + unexpected_role_count + 
                      duplicate_message_count + oversize_message_count;
  if (totalIssues > 0) {
    globalAnomalies.push({
      code: "STRUCTURAL_ISSUES",
      severity: missing_role_count > 0 ? "HIGH" : "MEDIUM",
      message: `${totalIssues} structural anomalies detected in transcript`,
    });
  }

  return {
    missing_role_count,
    empty_content_count,
    unexpected_role_count,
    duplicate_message_count,
    oversize_message_count,
    oversize_threshold_chars: OVERSIZE_THRESHOLD_CHARS,
    anomalies,
  };
}
