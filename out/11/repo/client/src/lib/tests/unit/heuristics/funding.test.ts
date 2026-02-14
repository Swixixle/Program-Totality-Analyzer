import { describe, it, expect } from "vitest";
import { computeFundingGravity } from "@/lib/heuristics/fundingGravity";
import { Pack } from "@/lib/schema/pack_v1";

describe("Heuristic: Funding Gravity (M4.2)", () => {
    
    // Fixture: 
    // Funder A -> Funds -> R1, R2, R3, R4 (Dominant Funder)
    // Funder B -> Funds -> R5
    // R1 -> Donated_to -> Funder A (Loop / Kickback check? Or just circular)
    // R1 is also funded_by Funder B (Cross funding)
    
    const fixture: Pack = {
        packId: "funding-fixture",
        packType: "topic_ecosystem",
        schemaVersion: 2,
        subjectName: "Funding Test",
        entities: [
            { id: "F1", name: "Funder A", type: "org" },
            { id: "F2", name: "Funder B", type: "org" },
            { id: "R1", name: "Recipient 1", type: "org" },
            { id: "R2", name: "Recipient 2", type: "org" },
            { id: "R3", name: "Recipient 3", type: "org" },
            { id: "R4", name: "Recipient 4", type: "org" },
            { id: "R5", name: "Recipient 5", type: "org" },
        ] as any,
        edges: [
            // F1 funds 4 people (canonical: donated_to)
            { id: "e1", fromEntityId: "F1", toEntityId: "R1", type: "donated_to" },
            { id: "e2", fromEntityId: "F1", toEntityId: "R2", type: "donated_to" },
            { id: "e3", fromEntityId: "F1", toEntityId: "R3", type: "donated_to" },
            { id: "e4", fromEntityId: "F1", toEntityId: "R4", type: "donated_to" },
            // F2 funds R5 (inverse: funded_by)
            { id: "e5", fromEntityId: "R5", toEntityId: "F2", type: "funded_by" },
             // R1 also funded by F2
            { id: "e6", fromEntityId: "R1", toEntityId: "F2", type: "funded_by" }
        ] as any,
        evidence: [],
        claims: [],
        timestamps: { created: "", updated: "" }
    };

    it("should correctly identify funders and recipients with canonical direction", () => {
        const result = computeFundingGravity(fixture);
        
        // F1 should be top funder
        expect(result.funders[0].entityId).toBe("F1");
        expect(result.funders[0].outgoingFundingEdges).toBe(4);
        
        // F2 should be second funder (funds R5 and R1)
        expect(result.funders[1].entityId).toBe("F2");
        expect(result.funders[1].outgoingFundingEdges).toBe(2);
    });

    it("should correctly identify recipients", () => {
        const result = computeFundingGravity(fixture);
        
        // R1 receives from F1 and F2
        const r1 = result.recipients.find(r => r.entityId === "R1");
        expect(r1).toBeDefined();
        expect(r1?.incomingFundingEdges).toBe(2);
        
        // R2 receives from F1 only
        const r2 = result.recipients.find(r => r.entityId === "R2");
        expect(r2?.incomingFundingEdges).toBe(1);
    });

    it("should calculate concentration metrics", () => {
        const result = computeFundingGravity(fixture);
        
        // Total Edges = 6
        // Top Funder (F1) has 4 edges
        // Share = 4/6 = 0.666...
        
        expect(result.concentration).toBeDefined();
        expect(result.concentration?.edgesCount).toBe(6);
        expect(result.concentration?.topFundersShare).toBeCloseTo(0.666, 2);
    });

    it("should return valid result for empty edges", () => {
        const empty = { ...fixture, edges: [] };
        const result = computeFundingGravity(empty);
        expect(result.funders).toHaveLength(0);
        expect(result.concentration).toBeUndefined();
    });
});
