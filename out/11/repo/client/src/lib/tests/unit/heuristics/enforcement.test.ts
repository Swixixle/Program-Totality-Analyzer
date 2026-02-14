import { describe, it, expect } from "vitest";
import { computeEnforcementMap } from "@/lib/heuristics/enforcementMap";
import { Pack } from "@/lib/schema/pack_v1";

describe("Heuristic: Enforcement Map (M4.3)", () => {

    const fixture: Pack = {
        packId: "enforcement-fixture",
        packType: "public_figure",
        schemaVersion: 2,
        subjectName: "Censorship Case",
        entities: [
            { id: "E1", name: "Big Tech Platform", type: "org" },
            { id: "E2", name: "Gov Agency", type: "org" },
            { id: "T1", name: "Dissident 1", type: "person" },
            { id: "T2", name: "Dissident 2", type: "person" },
            { id: "T3", name: "Journalist", type: "person" },
        ] as any,
        edges: [
            // E1 bans T1 and T2
            { id: "edge1", fromEntityId: "T1", toEntityId: "E1", type: "banned_by" },
            { id: "edge2", fromEntityId: "T2", toEntityId: "E1", type: "banned_by" },
            
            // E2 investigates E1 (The enforcer is investigated!)
            { id: "edge3", fromEntityId: "E1", toEntityId: "E2", type: "investigated_by" },

            // E1 censors T3
            { id: "edge4", fromEntityId: "T3", toEntityId: "E1", type: "censored_by" },
        ] as any,
        evidence: [],
        claims: [],
        timestamps: { created: "", updated: "" }
    };

    it("should identify top enforcers", () => {
        const result = computeEnforcementMap(fixture);
        
        // E1 performs 3 actions (bans T1, bans T2, censors T3)
        const e1 = result.enforcers.find(e => e.entityId === "E1");
        expect(e1).toBeDefined();
        expect(e1?.enforcementActions).toBe(3);

        // E2 performs 1 action (investigates E1)
        const e2 = result.enforcers.find(e => e.entityId === "E2");
        expect(e2?.enforcementActions).toBe(1);
    });

    it("should identify top targets", () => {
        const result = computeEnforcementMap(fixture);
        
        // T1, T2, T3 are targets once
        expect(result.targets.find(t => t.entityId === "T1")?.targetedActions).toBe(1);
        
        // E1 is also a target (of E2)
        expect(result.targets.find(t => t.entityId === "E1")?.targetedActions).toBe(1);
    });

    it("should breakdown by type", () => {
        const result = computeEnforcementMap(fixture);
        
        expect(result.breakdownByType["banned_by"]).toBe(2);
        expect(result.breakdownByType["censored_by"]).toBe(1);
        expect(result.breakdownByType["investigated_by"]).toBe(1);
        expect(result.breakdownByType["fired_by"]).toBeUndefined();
    });

    it("should handle empty data", () => {
        const empty = { ...fixture, edges: [] };
        const result = computeEnforcementMap(empty);
        expect(result.enforcers).toHaveLength(0);
        expect(result.targets).toHaveLength(0);
    });
});
