/**
 * Key Registry for Ed25519 signature verification
 * 
 * P3 Key Registry Governance:
 * - Keys have status: ACTIVE | REVOKED | EXPIRED
 * - Keys have validity period: valid_from, valid_to
 * - Keys have issuer_label for human-readable identification
 * - Revoked keys include revoked_reason
 * - Multiple keys per issuer supported (key rotation)
 */

import { verify, createPublicKey } from "crypto";

export type KeyStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface KeyEntry {
  public_key_id: string;
  public_key_pem: string;
  issuer_id: string;
  issuer_label: string;
  status: KeyStatus;
  valid_from: string;
  valid_to?: string;
  revoked_at?: string;
  revoked_reason?: string;
  added_at: string;
}

// In-memory key registry
const keyRegistry = new Map<string, KeyEntry>();

// Known test keys for development/testing
const TEST_KEYS: KeyEntry[] = [
  {
    public_key_id: "test-key-001",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAr7V4bQ4SLrzJD/pTnE1OFdHxTjyuH8ivnn1WSCP0+r4=
-----END PUBLIC KEY-----`,
    issuer_id: "test-issuer",
    issuer_label: "Test Issuer (Development)",
    status: "ACTIVE",
    valid_from: "2024-01-01T00:00:00Z",
    added_at: new Date().toISOString(),
  },
  {
    public_key_id: "test-key-002-rotated",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAr7V4bQ4SLrzJD/pTnE1OFdHxTjyuH8ivnn1WSCP0+r4=
-----END PUBLIC KEY-----`,
    issuer_id: "test-issuer",
    issuer_label: "Test Issuer (Development) - Rotated Key",
    status: "ACTIVE",
    valid_from: "2025-01-01T00:00:00Z",
    added_at: new Date().toISOString(),
  },
  {
    public_key_id: "revoked-key-001",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAr7V4bQ4SLrzJD/pTnE1OFdHxTjyuH8ivnn1WSCP0+r4=
-----END PUBLIC KEY-----`,
    issuer_id: "test-issuer",
    issuer_label: "Test Issuer (Development) - Revoked",
    status: "REVOKED",
    valid_from: "2024-01-01T00:00:00Z",
    revoked_at: "2025-06-01T00:00:00Z",
    revoked_reason: "Key compromised during security audit",
    added_at: new Date().toISOString(),
  },
  {
    public_key_id: "expired-key-001",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAr7V4bQ4SLrzJD/pTnE1OFdHxTjyuH8ivnn1WSCP0+r4=
-----END PUBLIC KEY-----`,
    issuer_id: "test-issuer",
    issuer_label: "Test Issuer (Development) - Expired",
    status: "EXPIRED",
    valid_from: "2023-01-01T00:00:00Z",
    valid_to: "2024-01-01T00:00:00Z",
    added_at: new Date().toISOString(),
  },
  {
    public_key_id: "untrusted-key-001",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAr7V4bQ4SLrzJD/pTnE1OFdHxTjyuH8ivnn1WSCP0+r4=
-----END PUBLIC KEY-----`,
    issuer_id: "unknown-issuer",
    issuer_label: "Unknown Issuer",
    status: "ACTIVE",
    valid_from: "2024-01-01T00:00:00Z",
    added_at: new Date().toISOString(),
  },
  {
    public_key_id: "halo-demo-key-001",
    public_key_pem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAHKz2pYx3ES1ZEPTvMoDaMhM3nErSzc0wT2P1SmBByPY=
-----END PUBLIC KEY-----`,
    issuer_id: "test-issuer",
    issuer_label: "HALO Demo Signing Key",
    status: "ACTIVE",
    valid_from: "2024-01-01T00:00:00Z",
    added_at: new Date().toISOString(),
  },
];

// Trusted issuer IDs
const TRUSTED_ISSUERS = new Set<string>(["test-issuer"]);

export function initializeKeyRegistry(): void {
  if (process.env.NODE_ENV !== "production") {
    TEST_KEYS.forEach(key => {
      keyRegistry.set(key.public_key_id, key);
    });
  }
}

export function addKey(entry: KeyEntry): void {
  keyRegistry.set(entry.public_key_id, entry);
}

export function removeKey(public_key_id: string): boolean {
  return keyRegistry.delete(public_key_id);
}

export function getKey(public_key_id: string): KeyEntry | undefined {
  return keyRegistry.get(public_key_id);
}

export function hasKey(public_key_id: string): boolean {
  return keyRegistry.has(public_key_id);
}

export function listKeys(): string[] {
  return Array.from(keyRegistry.keys());
}

export function getKeysByIssuer(issuer_id: string): KeyEntry[] {
  return Array.from(keyRegistry.values()).filter(k => k.issuer_id === issuer_id);
}

export function isIssuerTrusted(issuer_id: string): boolean {
  return TRUSTED_ISSUERS.has(issuer_id);
}

export function addTrustedIssuer(issuer_id: string): void {
  TRUSTED_ISSUERS.add(issuer_id);
}

export type SignatureStatus = "VALID" | "INVALID" | "UNTRUSTED_ISSUER" | "NO_SIGNATURE";

export interface SignatureVerificationResult {
  status: SignatureStatus;
  reason: string;
  public_key_id?: string;
  issuer_id?: string;
  issuer_label?: string;
  key_status?: KeyStatus;
  trusted?: boolean;
}

/**
 * Check if a key is currently valid based on status and validity period
 */
function isKeyValid(entry: KeyEntry, verifyTime: Date = new Date()): { valid: boolean; reason: string } {
  if (entry.status === "REVOKED") {
    return {
      valid: false,
      reason: `Key revoked: ${entry.revoked_reason || "No reason provided"}`,
    };
  }

  if (entry.status === "EXPIRED") {
    return {
      valid: false,
      reason: `Key expired on ${entry.valid_to || "unknown date"}`,
    };
  }

  const validFrom = new Date(entry.valid_from);
  if (verifyTime < validFrom) {
    return {
      valid: false,
      reason: `Key not yet valid (valid from ${entry.valid_from})`,
    };
  }

  if (entry.valid_to) {
    const validTo = new Date(entry.valid_to);
    if (verifyTime > validTo) {
      return {
        valid: false,
        reason: `Key expired on ${entry.valid_to}`,
      };
    }
  }

  return { valid: true, reason: "Key is active and within validity period" };
}

/**
 * Verify an Ed25519 signature with P3 governance
 */
export function verifySignature(
  message: string,
  signature: string,
  public_key_id: string
): SignatureVerificationResult {
  const keyEntry = getKey(public_key_id);
  
  if (!keyEntry) {
    return {
      status: "UNTRUSTED_ISSUER",
      reason: `Key ${public_key_id} not found in registry`,
      public_key_id,
    };
  }

  // Check key validity (status + time)
  const validity = isKeyValid(keyEntry);
  if (!validity.valid) {
    return {
      status: "UNTRUSTED_ISSUER",
      reason: validity.reason,
      public_key_id,
      issuer_id: keyEntry.issuer_id,
      issuer_label: keyEntry.issuer_label,
      key_status: keyEntry.status,
      trusted: false,
    };
  }

  // Check if issuer is trusted
  const issuerTrusted = isIssuerTrusted(keyEntry.issuer_id);

  try {
    const signatureBuffer = Buffer.from(signature, "base64");
    const messageBuffer = Buffer.from(message);
    const publicKey = createPublicKey(keyEntry.public_key_pem);
    const isValid = verify(null, messageBuffer, publicKey, signatureBuffer);
    
    if (isValid) {
      return {
        status: issuerTrusted ? "VALID" : "UNTRUSTED_ISSUER",
        reason: issuerTrusted 
          ? "Signature verified with trusted key" 
          : "Signature verified but issuer not in trusted list",
        public_key_id,
        issuer_id: keyEntry.issuer_id,
        issuer_label: keyEntry.issuer_label,
        key_status: keyEntry.status,
        trusted: issuerTrusted,
      };
    } else {
      return {
        status: "INVALID",
        reason: "Signature verification failed - signature does not match",
        public_key_id,
        issuer_id: keyEntry.issuer_id,
        issuer_label: keyEntry.issuer_label,
        key_status: keyEntry.status,
        trusted: issuerTrusted,
      };
    }
  } catch (error) {
    return {
      status: "INVALID",
      reason: `Signature verification error: ${(error as Error).message}`,
      public_key_id,
      issuer_id: keyEntry.issuer_id,
      issuer_label: keyEntry.issuer_label,
    };
  }
}

initializeKeyRegistry();
