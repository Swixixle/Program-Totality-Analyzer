import { describe, it, expect, beforeAll } from "vitest";
import { computeReportHash } from "@/lib/integrity";
import { Pack } from "@/lib/schema/pack_v1";

// Mock crypto for Node environment if needed
// Vitest with happy-dom/jsdom might have it.
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    // @ts-ignore
    globalThis.crypto = webcrypto;
}

describe("Report Integrity (M6.2)", () => {

    const packA: Pack = {
        packId: "p1",
        schemaVersion: 2,
        packType: "public_figure",
        subjectName: "Subject A",
        entities: [{ id: "e1", name: "E1", type: "person", aliases: [], tags: [] }],
        edges: [],
        evidence: [],
        claims: [],
        timestamps: { created: "", updated: "" }
    };

    const findings = {
        influence: { results: [{ entityId: "e1", degree: 1, inDegree: 1, outDegree: 0, supportingEdgeIds: [] }] },
        funding: null,
        enforcement: null
    };

    it("should produce a stable hash for same input", async () => {
        const hash1 = await computeReportHash(packA, findings);
        const hash2 = await computeReportHash(packA, findings);
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it("should produce different hash for different input", async () => {
        const packB = { ...packA, subjectName: "Subject B" };
        const hashA = await computeReportHash(packA, findings);
        const hashB = await computeReportHash(packB, findings);
        expect(hashA).not.toBe(hashB);
    });

    it("should be order-independent for entities (canonicalization)", async () => {
        const packUnsorted: Pack = {
            ...packA,
            entities: [
                { id: "b", name: "B", type: "person", aliases: [], tags: [] },
                { id: "a", name: "A", type: "person", aliases: [], tags: [] }
            ]
        };

        const packSorted: Pack = {
            ...packA,
            entities: [
                { id: "a", name: "A", type: "person", aliases: [], tags: [] },
                { id: "b", name: "B", type: "person", aliases: [], tags: [] }
            ]
        };

        const hash1 = await computeReportHash(packUnsorted, findings);
        const hash2 = await computeReportHash(packSorted, findings);

        expect(hash1).toBe(hash2);
    });
});
