
import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto"; // Use fake-indexeddb
import { persistence, LibraryState } from "@/lib/storage";
import { Pack, PackSchema } from "@/lib/schema/pack_v1";
import { LanternPack } from "@/lib/lanternExtract";

describe("M3.3 Certification Proof", () => {
    beforeEach(async () => {
        await persistence.clearLibrary();
        vi.clearAllMocks();
    });

    it("Proof 1: Persistence after reload", async () => {
        // 1. Create Dossier
        const dossier: Pack = {
            schema: "lantern.dossier.pack.v1", // Will be removed/ignored by PackSchema usually, or we update it? 
            // Wait, schemaVersion is the new discriminator. But 'schema' string was used in 'AnyPack' before.
            // Let's check Pack definition. PackSchema does NOT have 'schema' string field.
            // But LanternPack DOES. 'AnyPack' is discriminated by schema vs schemaVersion?
            // LanternPack has `schema: "lantern.extract.pack.v1"`.
            // Pack (V2) has `schemaVersion: 2` and `packType`.
            // We need to ensure discriminator works.
            packId: "dossier-123",
            packType: "public_figure",
            schemaVersion: 2,
            subjectName: "Test Subject",
            entities: [{ id: "e1", name: "E1", type: "person", aliases: [], tags: [] }],
            edges: [],
            evidence: [],
            claims: [{ id: "c1", text: "Test Claim", claimType: "fact", confidence: 1.0, evidenceIds: ["ev1"], counterEvidenceIds: [], createdAt: "" }],
            timestamps: { created: "", updated: "" }
        };

        // 2. Save
        const libState: LibraryState = { packs: [dossier] };
        await persistence.saveLibrary(libState);

        // 3. "Reload" (Load from fresh persistence call)
        const loaded = await persistence.loadLibrary();

        // 4. Verify
        expect(loaded).toBeDefined();
        expect(loaded?.packs.length).toBe(1);
        const loadedDossier = loaded?.packs[0] as Pack;
        expect(loadedDossier.packId).toBe("dossier-123");
        expect(loadedDossier.entities[0].name).toBe("E1");
        expect(loadedDossier.claims[0].text).toBe("Test Claim");
    });

    it("Proof 2: Export/Import coexistence", async () => {
        // 1. Setup Mixed Library
        const extractPack: LanternPack = {
            pack_id: "extract-1",
            schema: "lantern.extract.pack.v1",
            engine: { name: "test", version: "1" },
            source: { title: "Source 1", retrieved_at: "", url: "", author: "", publisher: "", published_at: "", source_type: "News" },
            items: { entities: [], quotes: [], metrics: [], timeline: [] },
            hashes: { source_text_sha256: "abc", pack_sha256: "def" },
            stats: { total_extracts: 0, confidence_avg: 0 }
        };

        const dossierPack: Pack = {
             packId: "dossier-1",
             packType: "public_figure",
             schemaVersion: 2,
             subjectName: "Subject 1",
             entities: [],
             edges: [],
             evidence: [],
             claims: [],
             timestamps: { created: "", updated: "" }
        };

        const originalLib: LibraryState = { packs: [extractPack, dossierPack] };
        
        // 2. "Export" (Serialize to JSON)
        const jsonExport = JSON.stringify(originalLib);

        // 3. Clear Library
        await persistence.clearLibrary();
        const cleared = await persistence.loadLibrary();
        expect(cleared).toBeNull();

        // 4. "Import" (Parse JSON and Save)
        const importedData = JSON.parse(jsonExport);
        // In real app, we validate schema here. The persistence layer just saves what it gets mostly, 
        // but let's assume valid JSON import.
        await persistence.saveLibrary(importedData);

        // 5. Verify Restoration
        const restored = await persistence.loadLibrary();
        expect(restored?.packs.length).toBe(2);
        
        const restoredExtract = restored?.packs.find(p => "schema" in p && p.schema === "lantern.extract.pack.v1");
        const restoredDossier = restored?.packs.find(p => "packId" in p); // Use packId as discriminator for Dossier

        expect(restoredExtract).toBeDefined();
        // @ts-ignore
        expect(restoredExtract.pack_id).toBe("extract-1");

        expect(restoredDossier).toBeDefined();
        // @ts-ignore
        expect(restoredDossier.packId).toBe("dossier-1");
    });
});
