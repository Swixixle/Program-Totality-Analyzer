import { Pack } from "@/lib/schema/pack_v1";
import { InfluenceHubsFinding, InfluenceHubResult } from "./types";

/**
 * M4.1 Influence Hubs Heuristic (Degree Centrality)
 * 
 * Computes degree centrality (in, out, total) for all entities in a dossier.
 * Returns a ranked list of entities.
 */
export function computeInfluenceHubs(pack: Pack): InfluenceHubsFinding {
  const entityStats = new Map<string, { in: number; out: number; edges: Set<string> }>();

  // Initialize stats for all entities
  pack.entities.forEach(e => {
    entityStats.set(e.id, { in: 0, out: 0, edges: new Set() });
  });

  // Walk edges
  pack.edges.forEach(edge => {
    const fromStats = entityStats.get(edge.fromEntityId);
    const toStats = entityStats.get(edge.toEntityId);

    if (fromStats) {
      fromStats.out += 1;
      fromStats.edges.add(edge.id);
    }
    
    if (toStats) {
      toStats.in += 1;
      toStats.edges.add(edge.id);
    }
  });

  // Convert to results
  const results: InfluenceHubResult[] = [];
  
  entityStats.forEach((stats, entityId) => {
    const totalDegree = stats.in + stats.out;
    if (totalDegree > 0) { // Only include connected nodes? Instructions say "return a ranked list of top N hubs". Let's include all > 0.
      results.push({
        entityId,
        degree: totalDegree,
        inDegree: stats.in,
        outDegree: stats.out,
        supportingEdgeIds: Array.from(stats.edges)
      });
    }
  });

  // Rank by total degree (descending)
  results.sort((a, b) => b.degree - a.degree);

  const THRESHOLD = 5; // Need at least 5 edges for meaningful centrality analysis
  const processedCount = pack.edges.length; // Approximate, or count connected edges specifically

  return {
    kind: "influence_hubs_v1",
    packId: pack.packId,
    generatedAt: new Date().toISOString(),
    status: processedCount >= THRESHOLD ? "sufficient" : "insufficient",
    threshold: THRESHOLD,
    processedCount,
    results
  };
}
