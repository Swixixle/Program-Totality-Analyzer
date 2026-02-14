
// Deterministic Rule-Based Sentence Segmenter
// M2 Priority #1: Sentence Segmentation

export type Segment = {
  text: string;
  start: number;
  end: number;
};

// --- CONFIGURATION ---

const ABBREVIATIONS = new Set([
  // Titles
  "dr", "mr", "mrs", "ms", "prof", "sr", "jr", "st", "mt", "rev", "rep", "sen", "gov", "pres",
  // Commercial
  "inc", "ltd", "co", "corp", "llc",
  // Geography
  "us", "usa", "uk", "eu", "uae", "ave", "st", "rd", "blvd", "hwy",
  // Time
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  "am", "pm", "ad", "bc", "bce", "ce",
  // Latin/Academic
  "et", "al", "etc", "eg", "ie", "vs", "v", "fig", "eq", "vol", "p", "pp", "ch", "sec",
  // Misc
  "approx", "min", "max", "avg", "no", "tel", "dept", "univ", "inst"
]);

const TERMINATORS = new Set([".", "!", "?", "…", "。", "！", "？"]);
const QUOTE_OPENS = new Set(['"', "'", "“", "‘", "«", "「"]);
const QUOTE_CLOSES = new Set(['"', "'", "”", "’", "»", "」"]);
const WRAPPERS = new Map([
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
]);

// --- MAIN SEGMENTER ---

export function segmentSentences(text: string): Segment[] {
  if (!text) return [];

  const segments: Segment[] = [];
  let start = 0;
  let len = text.length;
  
  // State
  let inQuote = false;
  let quoteChar: string | null = null;
  let parenDepth = 0;

  for (let i = 0; i < len; i++) {
    const char = text[i];
    const next = text[i + 1] || "";
    const prev = text[i - 1] || "";

    // 1. Quote Handling
    if (QUOTE_OPENS.has(char) && !inQuote) {
        // Special case: dumb quotes " can be open or close.
        // Heuristic: If preceded by space or start, it's open.
        // If preceded by word char, it's likely close (or apostrophe, handled separately?)
        // Let's assume standard " is open if !inQuote.
        inQuote = true;
        quoteChar = char;
        if (QUOTE_CLOSES.has(char) && char !== '"' && char !== "'") { 
             // If char is unique opener (like “), we good. 
             // If char is ambiguous ("), we assume open.
        }
    } else if (inQuote && QUOTE_CLOSES.has(char)) {
        // Check if matching close
        // Simplified: just check if it's a quote char.
        // Handling nested quotes is hard; we'll assume non-nested for M2.
        // If " is used for both, toggle.
        if (char === quoteChar || (quoteChar === '“' && char === '”') || (quoteChar === '‘' && char === '’')) {
             inQuote = false;
             quoteChar = null;
        }
    }

    // 2. Parentheses Handling
    if (WRAPPERS.has(char)) {
        parenDepth++;
    } else if (Array.from(WRAPPERS.values()).includes(char)) {
        if (parenDepth > 0) parenDepth--;
    }

    // 3. Terminator Check
    if (TERMINATORS.has(char)) {
        // Must be a valid split point.
        if (canSplit(text, i, inQuote, parenDepth)) {
            // INCLUDE the terminator in the current sentence
            // Check if there are trailing quote closes or parens that belong to this sentence
            let end = i + 1;
            
            // Consume closing quotes/parens immediately after terminator if they exist
            // e.g. "Hello." -> split after "
            while (end < len) {
                const c = text[end];
                if (QUOTE_CLOSES.has(c) || Array.from(WRAPPERS.values()).includes(c)) {
                    end++;
                    // Update state if we consumed a closer
                    if (inQuote && QUOTE_CLOSES.has(c)) { inQuote = false; quoteChar = null; }
                    if (parenDepth > 0 && Array.from(WRAPPERS.values()).includes(c)) parenDepth--;
                } else {
                    break;
                }
            }

            // Consume whitespace after the sentence (optional, but standard extractors usually trim)
            // BUT: Constraint says "Exact offsets", "segmentation must not reindex or normalize".
            // So we produce the segment covering the sentence + terminator. 
            // The "gap" (whitespace) effectively belongs to neither or is skipped?
            // Usually, Segment = [Start, End). Next Start = End + Whitespace.
            // Let's verify: "Hello. World." -> S1: "Hello." S2: "World."
            // The space is typically "between".
            // However, to preserve exact reconstruction, usually we say S1 ends at '.', S2 starts at 'W'.
            // The space is "ignored" or "skipped".
            // Let's stick to: Segment includes the terminator and any immediate closures.
            
            segments.push({
                text: text.slice(start, end),
                start: start,
                end: end
            });
            
            // Move start to next non-whitespace
            let nextStart = end;
            while (nextStart < len && /\s/.test(text[nextStart])) {
                nextStart++;
            }
            start = nextStart;
            
            // Fast forward loop
            i = nextStart - 1; // loop increments i
        }
    } else if (char === '\n') {
        // Hard newline check
        // If \n\n+, it's a paragraph break -> sentence break
        if (next === '\n' && start < i) {
             segments.push({
                text: text.slice(start, i),
                start: start,
                end: i
            });
            let nextStart = i;
            while (nextStart < len && /\s/.test(text[nextStart])) {
                nextStart++;
            }
            start = nextStart;
            i = nextStart - 1;
        }
    }
  }

  // Residual
  if (start < len) {
      segments.push({
          text: text.slice(start, len),
          start: start,
          end: len
      });
  }

  return segments;
}

// --- RULES ---

function canSplit(text: string, index: number, inQuote: boolean, parenDepth: number): boolean {
    const char = text[index];
    const prev = text[index - 1];
    const next = text[index + 1];
    
    // RULE 0: Hard Gates (Parens)
    // Never split inside parens (e.g., "(see Fig. 1)")
    if (parenDepth > 0) return false;

    // RULE 1: Quotes
    // If inside quote, only split if we are at the end of the quote?
    // "Hello world." -> split at . is fine if " follows.
    // "Hello world," he said. -> , is not terminator.
    // Logic: If in quote, we generally DON'T split unless the quote immediately closes.
    // But we handle "consume closing quotes" in the main loop.
    // So if we hit '.' inside a quote, and the next char is '"', we allow split (and consume '"').
    // If next char is NOT quote close, we assume it's an abbreviation or mid-quote punctuation?
    // NO, "I am. You are." inside a quote are two sentences.
    // BUT constraint says "quote continuity (don’t split mid-quote unless terminal boundary confirmed)"
    // Let's assume standard prose: "Sentence one. Sentence two." is valid split.
    // "Mr. Smith" inside quote is NOT.
    // So abbrev check must run even in quotes.

    // RULE 2: Numbers / Decimals / Currency / IP / Versions
    // 3.14, $1.50, v1.0.1
    if (char === '.') {
        if (isDigit(prev) && isDigit(next)) return false; // 3.14
        if (prev === '$' || prev === '€' || prev === '£') return false; // $.99
        
        // --- ACRONYM FIX (U.S., I.B.M.) ---
        const word = getPrecedingWord(text, index);
        if (word && word.length === 1 && isUpperCase(word)) {
            // Case 1: "U.S." -> First dot. Next char is 'S' (letter, not space).
            // If followed immediately by letter, it's a mid-acronym dot.
            if (next && /[a-zA-Z]/.test(next)) return false;

            // Case 2: "U.S." -> Second dot. Preceded by "U.".
            // If the preceding word was itself a single letter preceded by dot?
            // Need to look back further.
            // Index of 'S' is index-1.
            // Check char before 'S'.
            if (index >= 2 && text[index - 2] === '.') {
                // likely "X.Y." pattern.
                // We treat this as an abbreviation ending.
                // Apply "Next Word" logic (same as abbreviations).
                // "U.S. economy" -> lower -> no split.
                // "U.S. Government" -> upper -> ambiguous (but assume acronym -> no split?)
                // Actually, "U.S." is distinct.
                
                // Let's defer to the standard Abbreviation check logic below,
                // treating this single letter as a valid abbreviation.
            }
        }
    }

    // RULE 3: Abbreviations
    if (char === '.') {
        const word = getPrecedingWord(text, index);
        if (word) {
             const isSingleLetterAcronym = word.length === 1 && isUpperCase(word) && index >= 2 && text[index - 2] === '.';
             
             if (ABBREVIATIONS.has(word.toLowerCase()) || isSingleLetterAcronym) {
                // Look ahead for whitespace
                let lookahead = index + 1;
                while (lookahead < text.length && /\s/.test(text[lookahead])) lookahead++;
                const nextWordChar = text[lookahead];
                
                if (!nextWordChar) return true; // End of text -> Split
                
                // If followed by lowercase, it's definitely not a sentence end
                if (!isUpperCase(nextWordChar)) return false;
                
                // If followed by Uppercase:
                // Titles -> No split
                if (["dr", "mr", "mrs", "ms", "prof"].includes(word.toLowerCase())) return false;
                
                // Acronyms (U.S., I.B.M.) -> Ambiguous.
                // "U.S. Government" -> No Split usually?
                // "He joined the U.S. He is happy." -> Split.
                // This is the hardest case in segmentation.
                // Heuristic: If we are in "U.S.", we usually don't split?
                // Let's bias towards NO SPLIT for acronyms to preserve entity integrity.
                if (isSingleLetterAcronym) return false;

                // "etc. The" -> Split.
                if (["etc", "al", "viz", "vs", "e.g", "i.e"].includes(word.toLowerCase())) return true;
                
                // Default for other abbreviations: No Split?
                return false;
             }
        }
    }

    // RULE 4: Continued Quotes
    // handled in loop (we consume quotes if they follow).
    
    // RULE 5: Minimum Length
    // Sentences shouldn't be 1 char?
    
    return true;
}

// --- UTILS ---

function isDigit(char: string): boolean {
    return /[0-9]/.test(char);
}

function isUpperCase(char: string): boolean {
    return char !== char.toLowerCase() && char === char.toUpperCase();
}

function getPrecedingWord(text: string, index: number): string | null {
    // Walk back from index-1 until non-word char
    let i = index - 1;
    while (i >= 0 && /[a-zA-Z0-9]/.test(text[i])) {
        i--;
    }
    const word = text.slice(i + 1, index);
    return word.length > 0 ? word : null;
}
