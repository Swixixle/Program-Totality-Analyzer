import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto"; // Use fake-indexeddb
import { persistence, type LibraryState, SCHEMA_VERSION } from "../../storage";
import { LanternPack } from "../../lanternExtract";

describe("Persistence Layer (M2)", () => {
    
    beforeEach(async () => {
        await persistence.clearLibrary();
    });

    const mockPack: LanternPack = {
        pack_id: "test-pack-1",
        schema: "lantern.extract.pack.v1",
        hashes: { source_text_sha256: "abc", pack_sha256: "def" },
        engine: { name: "test", version: "0.1" },
        source: {
            title: "Test",
            author: "Tester",
            publisher: "TestPub",
            url: "http://test.com",
            published_at: "2023-01-01",
            retrieved_at: "2023-01-01T00:00:00Z",
            source_type: "News"
        },
        items: { entities: [], quotes: [], metrics: [], timeline: [] },
        stats: { duplicates_collapsed: 0, invalid_dropped: 0, headlines_suppressed: 0 }
    };

    const mockLibrary: LibraryState = {
        packs: [mockPack]
    };

    it("should handle round-trip persistence (Save -> Load -> Equality)", async () => {
        // Save
        await persistence.saveLibrary(mockLibrary);

        // Load
        const loaded = await persistence.loadLibrary();

        expect(loaded).toBeDefined();
        expect(loaded?.packs).toHaveLength(1);
        expect(loaded?.packs[0].pack_id).toBe("test-pack-1");
        expect(loaded?.packs).toEqual(mockLibrary.packs);
    });

    it("should initialize empty if no library exists", async () => {
        const loaded = await persistence.loadLibrary();
        // The implementation returns null if not found
        expect(loaded).toBeNull();
    });

    it("should clear library correctly", async () => {
        await persistence.saveLibrary(mockLibrary);
        await persistence.clearLibrary();
        const loaded = await persistence.loadLibrary();
        expect(loaded).toBeNull();
    });

    it("should handle large datasets (Stress Test)", async () => {
        const largeLibrary: LibraryState = {
            packs: Array(100).fill(null).map((_, i) => ({
                ...mockPack,
                pack_id: `pack-${i}`
            }))
        };
        
        await persistence.saveLibrary(largeLibrary);
        const loaded = await persistence.loadLibrary();
        expect(loaded?.packs).toHaveLength(100);
        expect(loaded?.packs[99].pack_id).toBe("pack-99");
    });
});
