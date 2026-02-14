import { describe, it, expect } from "vitest";
import { migratePack } from "@/lib/migrations";

describe("Schema Migrations (M6.1)", () => {

    it("should passthrough V2 packs", () => {
        const v2Pack = {
            schemaVersion: 2,
            packId: "v2-pack",
            packType: "public_figure",
            subjectName: "Valid V2",
            timestamps: { created: "", updated: "" },
            entities: [],
            edges: [],
            evidence: [],
            claims: []
        };
        
        const result = migratePack(v2Pack);
        expect(result).toEqual(v2Pack);
    });

    it("should migrate V1 packs to V2", () => {
        const v1Pack = {
            schemaVersion: 1, // Old version
            packId: "v1-pack",
            packType: "public_figure",
            subjectName: "Legacy V1",
            timestamps: { created: "", updated: "" },
            entities: [],
            edges: [],
            evidence: [],
            claims: []
        };
        
        const result = migratePack(v1Pack);
        expect(result.schemaVersion).toBe(2);
    });

    it("should remap unknown edge types to affiliated_with", () => {
        const legacyPack = {
            schemaVersion: 1,
            packId: "legacy-edges",
            packType: "public_figure",
            subjectName: "Unknown Edges",
            timestamps: { created: "", updated: "" },
            entities: [],
            edges: [
                { id: "e1", fromEntityId: "a", toEntityId: "b", type: "ancient_connection" } // Invalid Enum
            ],
            evidence: [],
            claims: []
        };

        const result = migratePack(legacyPack);
        
        expect(result.edges[0].type).toBe("affiliated_with");
        expect(result.edges[0].notes).toContain("(Original type: ancient_connection)");
        expect(result.schemaVersion).toBe(2);
    });
});
