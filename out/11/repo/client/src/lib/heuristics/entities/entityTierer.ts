
import { mockHash } from "../../lanternExtract";

export type EntityTier = "PRIMARY" | "SECONDARY" | "NOISE";

export type TieredEntity = {
    entity_id: string;
    text: string;
    canonical: string;
    tier: EntityTier;
    count: number; // For rollup logic
    mentions: number[]; // Indices of mentions in the provided list
};

export const tierEntities = (
    mentions: { text: string; canonical: string; isSentenceInitial: boolean }[]
): Map<string, EntityTier> => {
    const counts = new Map<string, number>();
    const definitions = new Map<string, { text: string, isSentenceInitialOnly: boolean }>();

    // 1. Aggregation
    mentions.forEach(m => {
        const key = m.canonical;
        counts.set(key, (counts.get(key) || 0) + 1);
        
        const existing = definitions.get(key);
        const isSentenceInitialOnly = (existing?.isSentenceInitialOnly ?? true) && m.isSentenceInitial;
        
        definitions.set(key, { 
            text: m.text, // Keep last seen text or specific logic? Usually longest/best.
            isSentenceInitialOnly 
        });
    });

    // 2. Tiering
    const tiers = new Map<string, EntityTier>();

    for (const [key, count] of counts.entries()) {
        const def = definitions.get(key)!;
        const text = def.text;
        
        // Rules
        const isMultiToken = text.includes(" ");
        const hasLegalSuffix = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?|GmbH|S\.A\.?|Pty|Plc)\b/i.test(text);
        const isAcronym = /^[A-Z0-9\.]+$/.test(text) && text.length > 1; // Basic acronym check
        const isSentenceInitialOnly = def.isSentenceInitialOnly;

        // Whitelist for common single-token entities that might appear sentence-initial
        // E.g. "Google", "Apple", "Facebook" - hard to distinguish from "Hope", "May" without dict.
        // Directive: "NOISE: single capitalized token that appears once AND is sentence-initial AND not in whitelist"
        // Let's assume a small mock whitelist or strict heuristic.
        const isWhitelisted = ["Google", "Apple", "Microsoft", "Amazon", "Tesla", "Replit", "OpenAI"].includes(key);

        let tier: EntityTier = "NOISE";

        if (isMultiToken || hasLegalSuffix || (isAcronym && count >= 2)) {
            tier = "PRIMARY";
        } else if (count >= 2 && !isSentenceInitialOnly) {
            // Repeats >= 2 but lacks strong pattern.
            // "Smith" (x2) -> Secondary.
            // "However" (x2, sentence initial) -> Still noise?
            // Wait, "isSentenceInitialOnly" check protects against "However" if it ONLY appears at start.
            // If "Smith" appears mid-sentence once, isSentenceInitialOnly = false.
            tier = "SECONDARY";
        } else if (count >= 2 && isSentenceInitialOnly) {
             // "However" ... "However" -> Noise.
             // "Apple" ... "Apple" (at start) -> Noise?
             // Unless whitelisted.
             if (isWhitelisted) tier = "SECONDARY"; // Or Primary?
             else tier = "NOISE";
        } else {
            // Single occurrence
            if (isSentenceInitialOnly && !isWhitelisted && !isMultiToken && !hasLegalSuffix) {
                tier = "NOISE";
            } else {
                 // Single occurrence, mid-sentence, capitalized.
                 // "I saw Smith." -> Smith (1, mid) -> Secondary?
                 // Directive: "NOISE: ... appears once AND is sentence-initial"
                 // So if NOT sentence-initial, it's NOT noise (default Secondary?)
                 tier = "SECONDARY";
            }
        }
        
        // Title-case fragments from headings check (Heuristic)
        // "Important Meeting In The Conference Room" -> Multi-token, but might be generic.
        // Hard to detect without structural cues (headings).
        // For now, assume capitalization rules handle most.
        // If > 5 words and all capped?
        if (text.split(" ").length > 5 && toTitleCase(text) === text) {
             // Maybe Noise?
        }

        tiers.set(key, tier);
    }

    return tiers;
};

// Helper for title case (duplicated, maybe move to util)
const toTitleCase = (str: string) => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};
