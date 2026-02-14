# Lantern Extract: Quality Contract (v1.0)

This document defines the strict rules for scoring extraction quality and calculating diffs. Any changes to these rules must be documented here to prevent metric drift.

## 1. Item Identity (Canonical Keys)

All diffs and quality scores must match items based on these structural keys, **never** on display strings or array indices.

| Stream    | Canonical Key Structure                                      | Notes                                                                 |
|-----------|--------------------------------------------------------------|-----------------------------------------------------------------------|
| **Entity**| `entity|<type>|<normalized_text>`                            | Normalized text ignores case and minor spacing.                       |
| **Quote** | `quote|<normalized_text>|<speaker_or_null>`                 | Speaker is part of identity. If speaker changes, it is a Diff Change. |
| **Metric**| `metric|<kind>|<unit>|<normalized_value>`                    | Unit and Kind are strict. Value allows constrained fuzziness.         |
| **Timeline**| `time|<date_type>|<normalized_date>`                       | Date type (explicit/relative) is strict.                              |

## 2. Constrained Fuzziness

Fuzzy matching is **only** permitted for Metric values and Date strings.

### Permitted Normalizations
- **Whitespace**: Multiple spaces collapse to single space (`5  M` -> `5 M`).
- **Dashes**: Unicode dashes normalize to hyphen (`–` -> `-`).
- **Separators**: Commas in numbers are stripped (`1,000` -> `1000`).
- **Casing**: Content matching is case-insensitive (but Casing features are preserved in extraction).

### Forbidden Normalizations (Strict Fail)
- **Units**: `USD` != `EUR`, `%` != `null`.
- **Metric Kind**: `range` != `scalar`.
- **Rate Denominators**: `per 100k` != `per 10k`.
- **Rounding**: `5.1` != `5`.

## 3. Diff Classification

When comparing two packs (Base vs Current):

- **Added**: Item Key exists in Current but not Base.
- **Removed**: Item Key exists in Base but not Current.
- **Changed**: Item Key exists in BOTH, but secondary attributes differ.
  - *Secondary Attributes*: Provenance spans, confidence scores, original raw text (if normalized key is same).

## 4. Cross-Mode Validation Rules

The engine must satisfy these monotonicity checks per stream. Violations are flagged as "Suspicious".

1. **Recall Monotonicity**: `Recall(Conservative) <= Recall(Balanced) <= Recall(Broad)`
   - Conservative mode should not find *more* items than Broad mode.
2. **Precision Monotonicity**: `Precision(Conservative) >= Precision(Balanced) >= Precision(Broad)`
   - Conservative mode should be *more accurate* than Broad mode.

## 5. Scoring Metrics

- **Precision**: `Valid_Actuals / Total_Actuals`
- **Recall**: `Matches / Total_Expected`
- **F1**: Harmonic mean of Precision and Recall.

---
*Last Updated: Lantern v0.1.5*
