
// M2 Priority #3A: Metric Normalization Schema Proposal

export enum MetricUnit {
    USD = "USD",
    EUR = "EUR",
    GBP = "GBP",
    PERCENT = "Percent",
    COUNT = "Count", // Users, Items, etc.
    UNKNOWN = "Unknown"
}

export enum MetricParseStatus {
    PARSED = "parsed",
    UNRESOLVED = "unresolved"
}

export enum UnresolvedReason {
    AMBIGUOUS_UNIT = "ambiguous_unit", // "5m" -> min vs million?
    AMBIGUOUS_VALUE = "ambiguous_value", // "1.200" -> 1,200 or 1.2?
    UNSUPPORTED_FORMAT = "unsupported_format", // "XII"
    NONE = "none"
}

export type NormalizedMetric = {
    // Provenance
    raw_text: string;
    start: number;
    end: number;
    rule_path: string; // "regex_currency_suffix", "regex_range_dash", etc.
    schema_version: string; // "lantern.metric.v1"

    // Normalization
    status: MetricParseStatus;
    unresolved_reason?: UnresolvedReason;

    // Value(s) - Policy 1: Single Object with Min/Max
    // For scalar, min_value === max_value
    min_value: number | null;
    max_value: number | null;
    
    // Units
    unit: MetricUnit;
    currency: string | null; // "USD", "EUR" - explicit field for query conv
    unit_raw: string | null; // "users", "million", "%"

    // Metadata
    multiplier_applied: number | null; // 1e6 for "M", 1e9 for "B"
    is_range: boolean;
};

// --- RULES & POLICIES ---

// POLICY: Ranges
// "10-12%" -> { min: 0.10, max: 0.12, is_range: true }
// "100" -> { min: 100, max: 100, is_range: false }

// POLICY: Ambiguity
// "5m" -> Unresolved (Ambiguous Unit). "5M" -> 5,000,000 (Count).
// "£12" -> { value: 12, currency: GBP, unit: USD? No, Unit=GBP } -> Unit Enum needs Currency?
// Let's refine MetricUnit to be broadly semantic, and Currency specific?
// Or MetricUnit includes currencies.
// Let's use MetricUnit.USD, MetricUnit.EUR.

// --- TYPES ---
