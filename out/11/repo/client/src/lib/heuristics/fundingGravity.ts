import { Pack } from "@/lib/schema/pack_v1";
import { FundingGravityFinding, FunderStat, RecipientStat } from "./types";

/**
 * M4.2 Funding Gravity Heuristic
 * 
 * Analyzes funding relationships to identify top funders, recipients, and concentration.
 * 
 * Canonical Direction: Funder -> Recipient
 */
export function computeFundingGravity(pack: Pack): FundingGravityFinding {
  
  // 1. Definition of Funding Edges & Direction
  // canonical: 'from' is funder, 'to' is recipient.
  const fundingTypes = new Set([
      "funded_by", "donated_to", "donated_by", "sponsored_by", "grant_from", "grant_to", "investment_in"
  ]);

  // Map to Canonical (Funder -> Recipient)
  // If returns true: keep direction (from->to)
  // If returns false: invert direction (to->from)
  const isCanonicalDirection = (type: string): boolean => {
      switch(type) {
          case "donated_to": return true; // Donor -> Recipient
          case "grant_to": return true;   // Grantor -> Grantee
          case "investment_in": return true; // Investor -> Asset
          case "sponsored_by": return false; // Event -> Sponsor (Wait. "Event sponsored by Corp". Corp is funder. So To->From)
          case "funded_by": return false;    // Recipient -> Funder
          case "donated_by": return false;   // Recipient -> Donor
          case "grant_from": return false;   // Grantee -> Grantor
          default: return true;
      }
  };

  const funderStats = new Map<string, FunderStat>();
  const recipientStats = new Map<string, RecipientStat>();
  
  let totalFundingEdges = 0;

  // Helper to init
  const getFunder = (id: string): FunderStat => {
      if (!funderStats.has(id)) {
          funderStats.set(id, { entityId: id, outgoingFundingEdges: 0, totalRecipients: 0, supportingEdgeIds: [] });
      }
      return funderStats.get(id)!;
  };

  const getRecipient = (id: string): RecipientStat => {
      if (!recipientStats.has(id)) {
          recipientStats.set(id, { entityId: id, incomingFundingEdges: 0, totalFunders: 0, supportingEdgeIds: [] });
      }
      return recipientStats.get(id)!;
  };

  // 2. Walk Edges
  pack.edges.forEach(edge => {
      if (!fundingTypes.has(edge.type)) return;

      totalFundingEdges++;

      let funderId: string;
      let recipientId: string;

      if (isCanonicalDirection(edge.type)) {
          funderId = edge.fromEntityId;
          recipientId = edge.toEntityId;
      } else {
          funderId = edge.toEntityId;
          recipientId = edge.fromEntityId;
      }

      // Update Funder
      const f = getFunder(funderId);
      f.outgoingFundingEdges++;
      f.supportingEdgeIds.push(edge.id);
      // Note: totalRecipients requires unique set count, doing simple increment for now. 
      // Correcting to Set for accuracy:
      // (Actually, let's track unique recipients in a separate structure or post-process? 
      //  Let's stick to edges count for v1 velocity unless requested. 
      //  Instruction says: "funder out-degree on funding edges". That is edge count.
      //  "totalRecipients" implies distinct entities. Let's do it right.)
      
      // Update Recipient
      const r = getRecipient(recipientId);
      r.incomingFundingEdges++;
      r.supportingEdgeIds.push(edge.id);
  });
  
  // Post-process for "Total Recipients/Funders" counts? 
  // Actually, computing unique degrees requires keeping Sets. Let's do a quick re-pass or map upgrade.
  // Optimization: Let's just use the edges. 
  
  // Refined Logic with Sets for Uniques
  const funderUniqueTargets = new Map<string, Set<string>>();
  const recipientUniqueSources = new Map<string, Set<string>>();
  
  pack.edges.forEach(edge => {
      if (!fundingTypes.has(edge.type)) return;
      
      let funderId: string;
      let recipientId: string;

      if (isCanonicalDirection(edge.type)) {
          funderId = edge.fromEntityId;
          recipientId = edge.toEntityId;
      } else {
          funderId = edge.toEntityId;
          recipientId = edge.fromEntityId;
      }
      
      if (!funderUniqueTargets.has(funderId)) funderUniqueTargets.set(funderId, new Set());
      funderUniqueTargets.get(funderId)!.add(recipientId);

      if (!recipientUniqueSources.has(recipientId)) recipientUniqueSources.set(recipientId, new Set());
      recipientUniqueSources.get(recipientId)!.add(funderId);
  });

  // Hydrate Counts
  funderStats.forEach(stat => {
      stat.totalRecipients = funderUniqueTargets.get(stat.entityId)?.size || 0;
  });
  recipientStats.forEach(stat => {
      stat.totalFunders = recipientUniqueSources.get(stat.entityId)?.size || 0;
  });

  // 3. Concentration Metrics
  const sortedFunders = Array.from(funderStats.values()).sort((a, b) => b.outgoingFundingEdges - a.outgoingFundingEdges);
  const sortedRecipients = Array.from(recipientStats.values()).sort((a, b) => b.incomingFundingEdges - a.incomingFundingEdges);

  const topFunderEdges = sortedFunders.length > 0 ? sortedFunders[0].outgoingFundingEdges : 0;
  const topRecipientEdges = sortedRecipients.length > 0 ? sortedRecipients[0].incomingFundingEdges : 0;

  const THRESHOLD = 3; // Need at least 3 funding edges

  return {
      kind: "funding_gravity_v1",
      packId: pack.packId,
      generatedAt: new Date().toISOString(),
      status: totalFundingEdges >= THRESHOLD ? "sufficient" : "insufficient",
      threshold: THRESHOLD,
      processedCount: totalFundingEdges,
      results: [], // Base interface compat
      funders: sortedFunders,
      recipients: sortedRecipients,
      concentration: totalFundingEdges > 0 ? {
          topFundersShare: topFunderEdges / totalFundingEdges,
          topRecipientsShare: topRecipientEdges / totalFundingEdges,
          edgesCount: totalFundingEdges
      } : undefined
  };
}
