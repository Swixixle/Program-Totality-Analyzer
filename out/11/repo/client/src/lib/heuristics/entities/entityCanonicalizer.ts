
// Rules for normalizing entity text for ID generation and grouping
// NO semantic resolution (Apple fruit vs Apple company)

export const normalizeEntity = (text: string): string => {
    if (!text) return "";

    let normalized = text.trim();

    // 1. Normalize Whitespace
    normalized = normalized.replace(/\s+/g, " ");

    // 2. Trim surrounding punctuation (quotes, parens, dashes)
    // Keep internal punctuation (e.g., "Yahoo!" or "U.S.")
    // Remove leading/trailing non-alphanumeric (mostly)
    // But be careful with "C++" or "A+"? 
    // Heuristic: Remove common wrappers like " ' ( ) [ ] { }
    normalized = normalized.replace(/^["'(\[{]+|["')\]}]+$/g, "");

    // 3. Normalize Corporate Suffix Punctuation
    // "Apple, Inc." -> "Apple Inc."
    // "Corp." -> "Corp" (optional, but standardizing helps)
    // Pattern: ", <Suffix>" -> " <Suffix>"
    const suffixes = ["Inc", "LLC", "Ltd", "Corp", "Co", "GmbH", "S\\.A", "Pty", "Plc"];
    const suffixRegex = new RegExp(`,\\s+(${suffixes.join("|")})\\.?$`, "i");
    normalized = normalized.replace(suffixRegex, " $1");
    
    // Also strip trailing dot from suffixes if they stand alone or after space
    // "Microsoft Corp." -> "Microsoft Corp"
    const suffixDotRegex = new RegExp(`\\s(${suffixes.join("|")})\\.$`, "i");
    normalized = normalized.replace(suffixDotRegex, " $1");


    // 4. Normalize Case (Title Case)
    // Only if it looks like a proper noun sequence.
    // Prevent "APPLE INC" -> "Apple Inc" blind conversion if it might lose meaning (e.g. acronyms).
    // Safe heuristic: If ALL CAPS, try to title case IF it matches a dict or is long?
    // Actually, "NASA" is all caps. "IBM" is all caps.
    // "APPLE INC" -> "Apple Inc" is probably safe.
    // "IBM" -> "Ibm" is BAD.
    // Heuristic: If all caps and contains spaces, Title Case it.
    // If single word all caps, keep it (could be acronym).
    if (normalized === normalized.toUpperCase() && normalized.includes(" ")) {
        normalized = toTitleCase(normalized);
    }

    return normalized.trim();
};

const toTitleCase = (str: string) => {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
};
