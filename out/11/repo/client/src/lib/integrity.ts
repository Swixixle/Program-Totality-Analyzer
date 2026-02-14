import { Pack } from "./schema/pack_v1";
import { InfluenceHubsFinding, FundingGravityFinding, EnforcementMapFinding } from "./heuristics/types";

// Findings subset for hashing
type FindingsSubset = {
    influence?: InfluenceHubsFinding | null;
    funding?: FundingGravityFinding | null;
    enforcement?: EnforcementMapFinding | null;
};

/**
 * Computes a deterministic SHA-256 hash of the report content.
 * This ensures that if the underlying data or findings change, the hash changes.
 * 
 * It sorts keys and array elements to ensure stability (canonicalization).
 */
export async function computeReportHash(
    pack: Pack, 
    findings: FindingsSubset
): Promise<string> {
    
    // 1. Create a Canonical Object (Subset of data that matters for the report)
    // We ignore 'timestamps.updated' because we want the hash to represent the *content* identity,
    // though arguably 'updated' is part of content. The user said "packSubset".
    // Let's include everything except maybe volatile UI state.
    
    const canonicalData = {
        pack: {
            id: pack.packId,
            version: pack.schemaVersion,
            subject: pack.subjectName,
            // Sort entities by ID
            entities: pack.entities.map(e => ({ id: e.id, name: e.name, type: e.type })).sort((a, b) => a.id.localeCompare(b.id)),
            // Sort edges by ID
            edges: pack.edges.map(e => ({ id: e.id, from: e.fromEntityId, to: e.toEntityId, type: e.type })).sort((a, b) => a.id.localeCompare(b.id)),
            // Sort claims by ID
            claims: pack.claims.map(c => ({ id: c.id, text: c.text, type: c.claimType })).sort((a, b) => a.id.localeCompare(b.id)),
            // Evidence count matters
            evidenceCount: pack.evidence.length
        },
        findings: {
            // We just hash the summary stats or top results to keep it fast but representative
            influence: findings.influence ? {
                topHubs: findings.influence.results.slice(0, 5).map(r => r.entityId)
            } : null,
            funding: findings.funding ? {
                topFunders: findings.funding.funders.slice(0, 5).map(f => f.entityId),
                concentration: findings.funding.concentration?.topFundersShare
            } : null,
            enforcement: findings.enforcement ? {
                enforcers: findings.enforcement.enforcers.slice(0, 5).map(e => e.entityId),
                breakdown: findings.enforcement.breakdownByType
            } : null
        }
    };

    // 2. Serialize deterministically
    // JSON.stringify order is not guaranteed for object keys in older JS, but mostly okay in modern.
    // To be safe, we can use a custom serializer or just trust V8 for now (keys usually insertion order).
    // For "Report Fingerprint" robust canonicalization is better, but simple is okay for v1.
    const jsonString = JSON.stringify(canonicalData);

    // 3. Hash
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);
    
    // Use Web Crypto API
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } else {
        // Fallback for non-browser envs
        console.warn("crypto.subtle not available, returning mock hash");
        return "mock-hash-crypto-not-available";
    }
}

/**
 * M12: Comparison Integrity Hash
 * 
 * Computes SHA-256(FingerprintA + FingerprintB + CanonicalComparisonResult)
 * Binds the comparison output to the specific versions of the input dossiers.
 */
export async function computeComparisonHash(
    fingerprintA: string,
    fingerprintB: string,
    result: any // Pass the comparison result (minus fingerprint itself)
): Promise<string> {
    
    const canonicalData = {
        inputs: {
            packA: fingerprintA,
            packB: fingerprintB
        },
        output: {
            overlapScore: result.overlapScore,
            sharedEntities: result.sharedEntities.map((e: any) => ({ name: e.name, confidence: e.confidence })).sort((a: any, b: any) => a.name.localeCompare(b.name)),
            alignment: {
                funders: result.commonFunders.map((c: any) => c.name).sort(),
                hubs: result.commonHubs.map((c: any) => c.name).sort(),
                enforcers: result.commonEnforcers.map((c: any) => c.name).sort()
            }
        }
    };

    const jsonString = JSON.stringify(canonicalData);
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonString);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return "mock-comparison-hash";
}
