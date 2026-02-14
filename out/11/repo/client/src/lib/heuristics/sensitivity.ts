import { Pack } from "../schema/pack_v1";
import { computeInfluenceHubs } from "./influenceHubs";
import { computeFundingGravity } from "./fundingGravity";

export interface RobustnessResult {
    heuristic: "influence" | "funding";
    score: number; // 0-100 (100 = highly robust)
    rating: "High" | "Moderate" | "Fragile";
    criticalEdges: string[]; // IDs of edges that, if removed, break the Top 1 ranking
    description: string;
}

export interface SensitivityReport {
    influence: RobustnessResult | null;
    funding: RobustnessResult | null;
}

/**
 * M11: Sensitivity / Robustness Lens
 * 
 * Measures stability of findings by testing:
 * "If we remove critical edges, do the primary conclusions (Top 1 ranking) change?"
 */
export function computeSensitivity(pack: Pack): SensitivityReport {
    
    // --- Influence Robustness ---
    let influenceResult: RobustnessResult | null = null;
    const baselineInfluence = computeInfluenceHubs(pack);

    if (baselineInfluence.status === "sufficient" && baselineInfluence.results.length > 0) {
        const top1 = baselineInfluence.results[0];
        const top1Id = top1.entityId;
        const criticalEdges: string[] = [];
        
        // Test: Remove each supporting edge of the Top 1 hub
        // If removing an edge causes them to lose Top 1 status, that edge is "Critical"
        // (A finding that relies on 1 specific edge is fragile)
        
        // Optimization: Only check supporting edges of Top 1
        const edgesToCheck = top1.supportingEdgeIds;
        
        edgesToCheck.forEach(edgeId => {
            // Create phantom pack without this edge
            const phantomPack = {
                ...pack,
                edges: pack.edges.filter(e => e.id !== edgeId)
            };
            
            const newResult = computeInfluenceHubs(phantomPack);
            if (newResult.results.length > 0 && newResult.results[0].entityId !== top1Id) {
                criticalEdges.push(edgeId);
            }
        });

        // Scoring: 
        // If 0 critical edges -> Robust (requires >1 edge removal to break)
        // If >0 critical edges -> Fragile (single point of failure)
        
        // Actually, let's look at it differently.
        // If they have 50 edges, and 1 breaks it, that's weird (means they barely won).
        // If they have 5 edges, and 1 breaks it, that's expected.
        
        // Rating Logic:
        // Fragile: Any single edge removal breaks Top 1.
        // Moderate: Stable against single edge removal, but margin < 10%.
        // High: Stable against single edge removal, margin > 10%.

        let rating: "High" | "Moderate" | "Fragile" = "High";
        if (criticalEdges.length > 0) {
            rating = "Fragile";
        } else {
            // Check Margin
            if (baselineInfluence.results.length > 1) {
                const margin = top1.degree - baselineInfluence.results[1].degree;
                if (margin <= 1) rating = "Moderate"; // Very close contest
            }
        }

        influenceResult = {
            heuristic: "influence",
            score: rating === "High" ? 100 : rating === "Moderate" ? 75 : 40,
            rating,
            criticalEdges,
            description: rating === "Fragile" 
                ? `Ranking is dependent on ${criticalEdges.length} specific relationships.` 
                : rating === "Moderate" 
                    ? "Top ranking is contested (margin ≤ 1 edge)." 
                    : "Top ranking is stable against single-point data loss."
        };
    }

    // --- Funding Robustness ---
    let fundingResult: RobustnessResult | null = null;
    const baselineFunding = computeFundingGravity(pack);

    if (baselineFunding.status === "sufficient" && baselineFunding.funders.length > 0) {
        const top1 = baselineFunding.funders[0];
        const top1Id = top1.entityId;
        const criticalEdges: string[] = [];

        top1.supportingEdgeIds.forEach(edgeId => {
            const phantomPack = {
                ...pack,
                edges: pack.edges.filter(e => e.id !== edgeId)
            };
            const newResult = computeFundingGravity(phantomPack);
            if (newResult.funders.length > 0 && newResult.funders[0].entityId !== top1Id) {
                criticalEdges.push(edgeId);
            }
        });

        let rating: "High" | "Moderate" | "Fragile" = "High";
        if (criticalEdges.length > 0) {
            rating = "Fragile";
        } else {
            if (baselineFunding.funders.length > 1) {
                const margin = top1.outgoingFundingEdges - baselineFunding.funders[1].outgoingFundingEdges;
                if (margin <= 1) rating = "Moderate";
            }
        }

        fundingResult = {
            heuristic: "funding",
            score: rating === "High" ? 100 : rating === "Moderate" ? 75 : 40,
            rating,
            criticalEdges,
            description: rating === "Fragile" 
                ? `Top funder status depends on ${criticalEdges.length} specific transactions.` 
                : rating === "Moderate" 
                    ? "Top funder status is contested (margin ≤ 1 edge)." 
                    : "Top funder status is stable against single-point data loss."
        };
    }

    return {
        influence: influenceResult,
        funding: fundingResult
    };
}
