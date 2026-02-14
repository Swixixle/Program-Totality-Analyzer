# LANTERN UX GOVERNANCE

> **Lantern is an Evidentiary Record System, not an insight engine.**
>
> All UI language must:
> - Describe process, not conclusions
> - Surface constraints, not confidence
> - Preserve traceability over persuasion
>
> The system must never:
> - Assert truth
> - Hide insufficiency
> - Collapse distinction between utterance and fact
> - Produce outputs that cannot survive adversarial review
>
> If a feature cannot be explained as:
> *"What was recorded, under what constraints, with what limits"*
> it does not belong in Lantern.

---

**Role Definition**: Lantern is an evidentiary record system, not a productivity app, dashboard, planner, or assistant.

Lantern's purpose is **epistemic containment**:
- To record claims
- To link evidence
- To apply constrained heuristics
- To show where evidentiary limits are exceeded

Lantern does not determine truth, intent, or guilt.

---

## Core Principles (Non-Negotiable)

### 1. NO NARRATIVE UX

Do not introduce:
- Progress metaphors
- "Journeys," "phases," or "paths"
- Success indicators
- Gamification
- Optimization framing

Lantern must feel procedural, cold, and forensic, not motivational.

### 2. NO IMPLIED CONCLUSIONS

The interface must never imply:
- That a finding is "good," "bad," or "important"
- That higher scores mean correctness
- That absence of data implies innocence or guilt

All analysis must be framed as conditional and bounded.

Every heuristic output must clearly show:
- Data sufficiency status
- Threshold requirements
- Processed counts

### 3. ABSENCE IS A FIRST-CLASS STATE

Empty states are correct behavior, not errors.

Prefer:
- "No extract packs yet"
- "Insufficient data for analysis"
- "Comparison unavailable due to density threshold"

Do not auto-generate placeholders, charts, or insights.

Silence is intentional.

### 4. LANGUAGE MUST BE PROCEDURAL

**Approved verbs**: Record, Link, Inspect, Compare, Verify, Export

**Disallowed verbs**: Discover, Reveal, Expose, Uncover, Prove, Optimize

Lantern documents boundaries, it does not persuade.

### 5. INTEGRITY METADATA IS ALWAYS VISIBLE

Never hide or downplay:
- Schema version
- Report fingerprint (SHA-256)
- Migration notes
- Claim scope (utterance vs content)
- Sufficiency gates

These are core UI elements, not advanced settings.

### 6. COMPARISON IS FORENSIC, NOT COMPETITIVE

The comparison view must feel like:
- A diff
- A cross-examination
- A lab comparison

Avoid:
- Scores framed as performance
- Leaderboard language
- "Alignment strength" metaphors

If either side lacks sufficient data, show Analysis Unavailable.

### 7. VISUAL DESIGN CONSTRAINTS

Design should communicate:
- Restraint
- Auditability
- Reluctance to conclude

Avoid:
- Bright success colors
- Emotional color coding
- Trend-implying animations

Warning/insufficient states should be neutral, amber, or gray, not alarming.

### 8. FIRST-TIME USER GUIDANCE MUST BE MECHANICAL

**Allowed**: "Extract packs contain structured claims derived from source text."

**Disallowed**: "Start your investigation by uncovering key insights."

No motivational copy. No calls to action that imply urgency or outcome.

### 9. DO NOT MERGE PRODUCT DOMAINS

Lantern must not visually or semantically resemble:
- Financial dashboards
- Planning tools
- AI assistants
- Intelligence "engines"

If any UI element resembles optimization, refactor or remove it.

---

## Success Criteria

A correct Lantern UI:
- Is boring in the way court filings are boring
- Makes misuse difficult
- Makes verification easy
- Refuses to speak where evidence is thin
- Survives hostile scrutiny

If a feature increases persuasion more than auditability, it is wrong.

---

## Final Check Before Any Change

Before committing any UX change, ask:

> "Does this help someone measure overreach — or does it help them tell a story?"

If it tells a story, do not ship it.

---

## DO NOT ADD Blacklist

- Progress bars / completion percentages
- "Insights" sections
- AI-generated summaries or conclusions
- Success/failure indicators
- Trend arrows or performance graphs
- Motivational copy or calls-to-action
- "Smart" suggestions or recommendations
- Gamification elements (badges, streaks, scores)
- "Journey" or "path" metaphors
- Competitive comparison language
