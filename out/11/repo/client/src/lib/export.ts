import { Pack, Entity } from "./schema/pack_v1";
import { 
    InfluenceHubsFinding, 
    FundingGravityFinding, 
    EnforcementMapFinding,
    InfluenceHubResult,
    FunderStat,
    RecipientStat,
    EnforcerStat,
    TargetStat
} from "./heuristics/types";

// Hardening Helper
const safeStr = (str: string): string => {
    // Escape pipes, backticks, etc.
    return str.replace(/\|/g, "\\|").replace(/`/g, "\\`");
};

export function generateMarkdown(
    pack: Pack,
    findings: {
        influence: InfluenceHubsFinding | null,
        funding: FundingGravityFinding | null,
        enforcement: EnforcementMapFinding | null
    },
    reportHash: string
): string {
    const date = new Date().toISOString().split('T')[0];
    
    // --- Header & Frontmatter ---
    let md = `---
title: "${safeStr(pack.subjectName)} - Dossier Report"
date: ${date}
packId: ${pack.packId}
schemaVersion: ${pack.schemaVersion}
fingerprint: ${reportHash}
generatedBy: Lantern Protocol
---

# ${safeStr(pack.subjectName)}
**Dossier ID:** \`${pack.packId}\`
**Date:** ${date}
**Fingerprint (SHA-256):** \`${reportHash}\`

> **Interpretation Limits & Disclaimer**
> * **Heuristics are indicators, not verdicts.** Structural centrality or funding flows suggest influence pathways but do not prove wrongdoing or intent.
> * **Evidence is point-in-time.** Claims are based on available public records as of the extraction date.
> * **Automated Analysis.** This report was generated with the assistance of the Lantern Protocol. Verification by human analysts is required for high-stakes decisions.

`;

    // --- Migration Log ---
    if (pack.migrationLog && pack.migrationLog.length > 0) {
        md += `### ⚠️ Data Migration Notes\n`;
        pack.migrationLog.forEach(log => {
            md += `- ${safeStr(log)}\n`;
        });
        md += `\n`;
    }

    // --- Executive Summary ---
    md += `## 01. Executive Summary\n\n`;
    md += `* **Verified Facts:** ${pack.claims.filter(c => c.claimType === "fact").length}\n`;
    md += `* **Allegations:** ${pack.claims.filter(c => c.claimType === "allegation").length}\n`;
    md += `* **Evidence Items:** ${pack.evidence.length}\n`;
    md += `* **Relationships:** ${pack.edges.length}\n\n`;
    
    md += `This dossier compiles intelligence regarding **${safeStr(pack.subjectName)}**, identifying key structural influence, financial flows, and enforcement actions. Analysis generated via Lantern Shadow-Caste heuristics (v1).\n\n`;

    // --- Structural Influence ---
    if (findings.influence) {
        md += `## 02. Structural Influence (Hubs)\n\n`;
        
        if (findings.influence.status === "insufficient") {
             md += `> **Insufficient Data:** This section requires at least ${findings.influence.threshold} relationships to generate a structural analysis. Current count: ${findings.influence.processedCount}.\n\n`;
        } else if (findings.influence.results.length > 0) {
            md += `| Rank | Entity | Degree | Citations |\n`;
            md += `|------|--------|--------|-----------|\n`;
            findings.influence.results.slice(0, 10).forEach((res: InfluenceHubResult, i: number) => {
                const entity = pack.entities.find((e: Entity) => e.id === res.entityId);
                md += `| ${i+1} | ${safeStr(entity?.name || "Unknown")} | ${res.degree} | ${res.supportingEdgeIds.length} |\n`;
            });
            md += `\n`;
        }
    }

    // --- Financial Flows ---
    if (findings.funding) {
        md += `## 03. Financial Flows (Gravity)\n\n`;
        
        if (findings.funding.status === "insufficient") {
             md += `> **Insufficient Data:** This section requires at least ${findings.funding.threshold} verified funding relationships. Current count: ${findings.funding.processedCount}.\n\n`;
        } else if (findings.funding.concentration) {
            md += `### Top Funders\n`;
            findings.funding.funders.slice(0, 5).forEach((f: FunderStat, i: number) => {
                const entity = pack.entities.find((e: Entity) => e.id === f.entityId);
                md += `${i+1}. **${safeStr(entity?.name || "Unknown")}** (${f.outgoingFundingEdges} Out)\n`;
            });
            md += `\n`;

            md += `### Top Recipients\n`;
            findings.funding.recipients.slice(0, 5).forEach((r: RecipientStat, i: number) => {
                const entity = pack.entities.find((e: Entity) => e.id === r.entityId);
                md += `${i+1}. **${safeStr(entity?.name || "Unknown")}** (${r.incomingFundingEdges} In)\n`;
            });
            md += `\n`;
            
            md += `> **Concentration:** The top funder controls ${(findings.funding.concentration.topFundersShare * 100).toFixed(1)}% of all mapped flows.\n\n`;
            md += `*Receipt: Processed ${findings.funding.processedCount} funding edges.*\n\n`;
        }
    }

    // --- Enforcement ---
    if (findings.enforcement) {
        md += `## 04. Gatekeeping & Enforcement\n\n`;
        
        if (findings.enforcement.status === "insufficient") {
             md += `> **Insufficient Data:** This section requires at least ${findings.enforcement.threshold} verified enforcement events. Current count: ${findings.enforcement.processedCount}.\n\n`;
        } else if (findings.enforcement.enforcers.length > 0) {
            md += `### Enforcers (Active)\n`;
            findings.enforcement.enforcers.slice(0, 5).forEach((e: EnforcerStat, i: number) => {
                const entity = pack.entities.find((ent: Entity) => ent.id === e.entityId);
                md += `- **${safeStr(entity?.name || "Unknown")}**: ${e.enforcementActions} Actions\n`;
            });
            md += `\n`;

            md += `### Targets (Passive)\n`;
            findings.enforcement.targets.slice(0, 5).forEach((t: TargetStat, i: number) => {
                const entity = pack.entities.find((ent: Entity) => ent.id === t.entityId);
                md += `- **${safeStr(entity?.name || "Unknown")}**: ${t.targetedActions} In\n`;
            });
            md += `\n`;

            md += `**Breakdown:** `;
            md += Object.entries(findings.enforcement.breakdownByType)
                .map(([type, count]) => `${type.replace("_by", "")}: ${count}`)
                .join(", ");
            md += `\n\n`;
            
            md += `*Receipt: Identified ${findings.enforcement.enforcers.length} active enforcers and ${findings.enforcement.targets.length} targets.*\n\n`;
        }
    }

    // --- Appendix ---
    md += `## Appendix: Verified Claims\n\n`;
    
    // Sort claims by confidence (desc) then date (asc)
    const sortedClaims = [...pack.claims].sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.createdAt.localeCompare(b.createdAt);
    });

    sortedClaims.forEach((claim, i) => {
        md += `### C-${i+1} (${claim.claimType.toUpperCase()})\n`;
        md += `> ${safeStr(claim.text)}\n\n`;
        md += `**Scope:** ${claim.claimScope || "content"} | **Confidence:** ${claim.confidence}\n\n`;
        
        if (claim.evidenceIds.length > 0) {
            md += `**Supporting Evidence:**\n`;
            claim.evidenceIds.forEach(eid => {
                const ev = pack.evidence.find(e => e.id === eid);
                if (ev) {
                    md += `- [${ev.sourceType}] ${safeStr(ev.title)} (${ev.date}) ${ev.url ? `[Link](${ev.url})` : ''}\n`;
                }
            });
            md += `\n`;
        }
    });

    return md;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
