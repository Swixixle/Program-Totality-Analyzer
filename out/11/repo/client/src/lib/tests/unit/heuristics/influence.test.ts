import { describe, it, expect } from "vitest";
import { computeInfluenceHubs } from "@/lib/heuristics/influenceHubs";
import { Pack } from "@/lib/schema/pack_v1";

describe("Heuristic: Influence Hubs (M4.1)", () => {
  // Fixture: A star graph where Center (E1) is connected to 3 leaves.
  // E1 -> E2
  // E3 -> E1
  // E1 -> E4
  const fixturePack: Pack = {
    packId: "fixture-1",
    packType: "public_figure",
    schemaVersion: 2,
    subjectName: "Star Graph",
    entities: [
      { id: "e1", name: "Center", type: "person", aliases: [], tags: [] },
      { id: "e2", name: "Leaf 2", type: "person", aliases: [], tags: [] },
      { id: "e3", name: "Leaf 3", type: "person", aliases: [], tags: [] },
      { id: "e4", name: "Leaf 4", type: "person", aliases: [], tags: [] },
    ],
    edges: [
      { id: "edge1", fromEntityId: "e1", toEntityId: "e2", type: "affiliated_with" },
      { id: "edge2", fromEntityId: "e3", toEntityId: "e1", type: "affiliated_with" },
      { id: "edge3", fromEntityId: "e1", toEntityId: "e4", type: "affiliated_with" },
    ],
    evidence: [],
    claims: [],
    timestamps: { created: "", updated: "" }
  };

  it("should identify the central hub correctly", () => {
    const finding = computeInfluenceHubs(fixturePack);
    
    expect(finding.kind).toBe("influence_hubs_v1");
    expect(finding.packId).toBe("fixture-1");
    
    const center = finding.results.find(r => r.entityId === "e1");
    expect(center).toBeDefined();
    expect(center?.degree).toBe(3); // 2 out + 1 in
    expect(center?.outDegree).toBe(2);
    expect(center?.inDegree).toBe(1);
    expect(center?.supportingEdgeIds).toHaveLength(3);
    expect(center?.supportingEdgeIds).toContain("edge1");
    expect(center?.supportingEdgeIds).toContain("edge2");
    expect(center?.supportingEdgeIds).toContain("edge3");
  });

  it("should rank hubs by degree descending", () => {
     const finding = computeInfluenceHubs(fixturePack);
     
     // E1 (3) should be first
     expect(finding.results[0].entityId).toBe("e1");
     
     // Others (1) should follow
     expect(finding.results[1].degree).toBe(1);
  });

  it("should handle disconnected entities (degree 0)", () => {
      const disconnectedPack: PackV1 = {
          ...fixturePack,
          entities: [...fixturePack.entities, { id: "e5", name: "Loner", type: "person", aliases: [], tags: [] }]
      };
      
      const finding = computeInfluenceHubs(disconnectedPack);
      // Implementation choice: do we include degree 0? 
      // The code I wrote excludes them if (totalDegree > 0). 
      // Let's verify that behavior or decide if we want them.
      // Usually "Hubs" implies connections. Let's stick to exclusion of 0-degree for noise reduction.
      expect(finding.results.find(r => r.entityId === "e5")).toBeUndefined();
  });
});
