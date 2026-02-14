import { Pack } from "@/lib/schema/pack_v1";
import { EnforcementMapFinding, EnforcerStat, TargetStat } from "./types";

/**
 * M4.3 Enforcement Map Heuristic
 * 
 * Detects enforcement and gatekeeping relationships (censorship, litigation, termination, etc.)
 * 
 * Direction Interpretation for "_by" types:
 * A censored_by B -> A is Target, B is Enforcer.
 * A regulated_by B -> A is Target, B is Enforcer.
 */
export function computeEnforcementMap(pack: Pack): EnforcementMapFinding {
    
    const enforcementTypes = new Set([
        "censored_by",
        "banned_by",
        "sued_by",
        "threatened_by",
        "fired_by",
        "investigated_by",
        "sanctioned_by",
        "regulated_by",
        "licensed_by"
    ]);

    const enforcerStats = new Map<string, EnforcerStat>();
    const targetStats = new Map<string, TargetStat>();
    const breakdownByType: Record<string, number> = {};

    // Helper
    const getEnforcer = (id: string): EnforcerStat => {
        if (!enforcerStats.has(id)) {
            enforcerStats.set(id, { entityId: id, enforcementActions: 0, supportingEdgeIds: [] });
        }
        return enforcerStats.get(id)!;
    };

    const getTarget = (id: string): TargetStat => {
        if (!targetStats.has(id)) {
            targetStats.set(id, { entityId: id, targetedActions: 0, supportingEdgeIds: [] });
        }
        return targetStats.get(id)!;
    };

    pack.edges.forEach(edge => {
        if (!enforcementTypes.has(edge.type)) return;

        // "A [verb]_by B" implies B did it to A.
        // from: A (Target)
        // to: B (Enforcer)
        const targetId = edge.fromEntityId;
        const enforcerId = edge.toEntityId;

        const enforcer = getEnforcer(enforcerId);
        enforcer.enforcementActions++;
        enforcer.supportingEdgeIds.push(edge.id);

        const target = getTarget(targetId);
        target.targetedActions++;
        target.supportingEdgeIds.push(edge.id);

        // Update Breakdown
        breakdownByType[edge.type] = (breakdownByType[edge.type] || 0) + 1;
    });

    const sortedEnforcers = Array.from(enforcerStats.values()).sort((a, b) => b.enforcementActions - a.enforcementActions);
    const sortedTargets = Array.from(targetStats.values()).sort((a, b) => b.targetedActions - a.targetedActions);

    const THRESHOLD = 1; // Even 1 enforcement action is notable
    const totalEnforcementEdges = Object.values(breakdownByType).reduce((a, b) => a + b, 0);

    return {
        kind: "enforcement_map_v1",
        packId: pack.packId,
        generatedAt: new Date().toISOString(),
        status: totalEnforcementEdges >= THRESHOLD ? "sufficient" : "insufficient",
        threshold: THRESHOLD,
        processedCount: totalEnforcementEdges,
        results: [], // Base interface compat
        enforcers: sortedEnforcers,
        targets: sortedTargets,
        breakdownByType
    };
}
