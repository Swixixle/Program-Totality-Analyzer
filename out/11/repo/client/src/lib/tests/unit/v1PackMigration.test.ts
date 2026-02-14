import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDossierPack, isExtractPack, type AnyPack } from '../../storage';
import { migratePack } from '../../migrations';

describe("V1 Pack Compatibility (Critical Acceptance Test)", () => {
    
    const v1DossierPack = {
        packId: "legacy-v1-pack",
        schemaVersion: 1 as const,
        title: "Legacy Dossier",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
        entities: [
            { id: "e1", name: "Test Entity", type: "person", aliases: [], tags: [] }
        ],
        edges: [
            { id: "edge1", sourceId: "e1", targetId: "e1", type: "affiliated_with", notes: "" }
        ],
        evidence: [],
        claims: []
    };

    const v2DossierPack = {
        packId: "current-v2-pack",
        packType: "public_figure" as const,
        schemaVersion: 2 as const,
        subjectName: "Current Dossier",
        timestamps: { created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z" },
        entities: [],
        edges: [],
        evidence: [],
        claims: [],
        migrationLog: []
    };

    const extractPack = {
        pack_id: "extract-pack-123",
        schema: "lantern.extract.pack.v1" as const,
        source_document: { title: "Test Doc", retrieved: "2026-01-01", uri: "test.txt" },
        extraction_options: {},
        contents: { entities: [], quotes: [], metrics: [], timeline: [] },
        provenance: []
    };

    describe("Type Guard: isDossierPack", () => {
        it("should detect v1 dossier packs", () => {
            expect(isDossierPack(v1DossierPack as unknown as AnyPack)).toBe(true);
        });

        it("should detect v2 dossier packs", () => {
            expect(isDossierPack(v2DossierPack as unknown as AnyPack)).toBe(true);
        });

        it("should NOT detect extract packs as dossier", () => {
            expect(isDossierPack(extractPack as unknown as AnyPack)).toBe(false);
        });
    });

    describe("Type Guard: isExtractPack", () => {
        it("should detect extract packs", () => {
            expect(isExtractPack(extractPack as unknown as AnyPack)).toBe(true);
        });

        it("should NOT detect v1 dossiers as extract", () => {
            expect(isExtractPack(v1DossierPack as unknown as AnyPack)).toBe(false);
        });

        it("should NOT detect v2 dossiers as extract", () => {
            expect(isExtractPack(v2DossierPack as unknown as AnyPack)).toBe(false);
        });
    });

    describe("Migration: V1 → V2", () => {
        it("should migrate v1 pack to v2", () => {
            const migrated = migratePack(v1DossierPack);
            expect(migrated.schemaVersion).toBe(2);
            expect(migrated.packId).toBe("legacy-v1-pack");
            expect(migrated.subjectName).toBe("Legacy Dossier");
        });

        it("should preserve entities through migration", () => {
            const migrated = migratePack(v1DossierPack);
            expect(migrated.entities).toHaveLength(1);
            expect(migrated.entities[0].name).toBe("Test Entity");
        });

        it("should add migrationLog during migration", () => {
            const v1WithBadEdge = {
                ...v1DossierPack,
                edges: [{ id: "e1", sourceId: "e1", targetId: "e1", type: "unknown_legacy_type", notes: "" }]
            };
            const migrated = migratePack(v1WithBadEdge);
            expect(migrated.migrationLog).toBeDefined();
            expect(migrated.migrationLog.length).toBeGreaterThan(0);
        });

        it("should pass v2 packs through unchanged", () => {
            const migrated = migratePack(v2DossierPack);
            expect(migrated.schemaVersion).toBe(2);
            expect(migrated.packId).toBe("current-v2-pack");
        });
    });

    describe("Critical: No Pack Orphaning", () => {
        it("every pack type should be detected by exactly one type guard", () => {
            const allPacks = [v1DossierPack, v2DossierPack, extractPack];
            
            for (const pack of allPacks) {
                const anyPack = pack as unknown as AnyPack;
                const isExtract = isExtractPack(anyPack);
                const isDossier = isDossierPack(anyPack);
                
                expect(isExtract || isDossier).toBe(true);
                expect(isExtract && isDossier).toBe(false);
            }
        });
    });
});
