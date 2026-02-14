
import { normalizeEntity } from "./entityCanonicalizer";
import { tierEntities, type EntityTier } from "./entityTierer";
import { mockHash } from "../../lanternExtract";

export type ExtractedEntity = {
    text: string;
    canonical: string;
    entity_id: string;
    tier: EntityTier;
    start: number;
    end: number;
    mention_index: number;
};

export const extractEntities = (text: string): ExtractedEntity[] => {
    if (!text) return [];

    // 1. Raw Extraction (Regex-based Capitalization)
    // Constraints: Rule-based, offsets exact.
    // Pattern: Capitalized word, optionally followed by more capitalized words or "of/and" connectors?
    // Basic: ([A-Z][a-z0-9\.]*) (\s [A-Z][a-z0-9\.]*)*
    // Allow inner-caps? "iPhone" -> maybe not for "Capitalized" heuristic.
    // Allow single letter? "A" -> usually noise. "U.S." -> yes.
    
    // Regex: 
    // \b[A-Z][\w\.]+(?:\s+(?:of|and|the|&)\s+[A-Z][\w\.]+)*\b
    // But be careful with "The".
    
    // Simpler heuristic for M2:
    // Sequence of capitalized words.
    // Handling "of the" inside: "United States of America".
    
    const capWord = /[A-Z][a-zA-Z0-9\.]+/;
    const suffixes = "Inc|LLC|Ltd|Corp|Co|GmbH|S\\.A|Pty|Plc";
    
    const regex = new RegExp(
        // Start with Cap
        `(${capWord.source}` +
        // Optional continuations: 
        // 1. space + Cap
        // 2. space + connector + space + Cap
        // 3. comma + space + Suffix (Explicit Suffix handling)
        `(?:` +
           `\\s+(?:${capWord.source}|(?:of|and|the|&)\\s+${capWord.source})` +
           `|` +
           `,\\s+(?:${suffixes})\\.?` + // Comma jump for suffixes
        `)*` +
        `)`,
        "g"
    );

    const rawMentions: { text: string; start: number; end: number; isSentenceInitial: boolean }[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        const mentionText = match[0];
        const start = match.index;
        const end = start + mentionText.length;
        
        // Filter Constraints
        // Min length > 2? "Al" is a name. "Ed". "Bo". 
        // "A" is noise.
        if (mentionText.length < 2) continue;
        
        // "The" exclusion (if it's the WHOLE match)
        if (["The", "This", "That", "There", "Here", "When", "What", "Who"].includes(mentionText)) {
             // Only exclude if it's likely a sentence starter word, not "The Who" band.
             // We'll tag sentence-initial later.
             // But purely stopwords are usually noise if single.
        }

        // Sentence Initial Detection
        // Look behind for [.?!] + space?
        // Or start of string.
        let isSentenceInitial = false;
        if (start === 0) {
            isSentenceInitial = true;
        } else {
             // Scan backwards skipping whitespace
             let i = start - 1;
             while (i >= 0 && /\s/.test(text[i])) i--;
             if (i < 0) isSentenceInitial = true;
             else if (['.', '!', '?', '"', '“'].includes(text[i])) isSentenceInitial = true;
        }

        rawMentions.push({ text: mentionText, start, end, isSentenceInitial });
    }

    // 2. Prepare for Tiering
    const preTiering = rawMentions.map(m => ({
        ...m,
        canonical: normalizeEntity(m.text)
    }));

    // 3. Tiering
    const tierMap = tierEntities(preTiering);

    // 4. Format Output
    return preTiering.map((m, index) => {
        const canonical = m.canonical;
        const tier = tierMap.get(canonical) || "NOISE";
        const entity_id = mockHash(canonical); // Stable ID

        return {
            text: m.text,
            canonical,
            entity_id,
            tier,
            start: m.start,
            end: m.end,
            mention_index: index
        };
    });
};
