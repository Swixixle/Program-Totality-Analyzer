# Lantern Live Demo Script
## 5-7 Minutes — Payor + Legal/Compliance Lane

---

## Setup (Before Demo)

1. Have the app running at `/`
2. Pre-load one Extract Pack with sample investigative text (entity-rich content)
3. Have one Dossier already partially curated (to show mid-workflow state)
4. Clear browser console of any errors
5. Test that all navigation works

---

## Demo Flow

### Opening (30 seconds)

**SAY:**
> "Let me show you Lantern in action. This is not a slide deck — this is the actual system. I'll walk you through what an analyst sees when they're building a defensible evidence record."

**DO:** Start at the home page `/`

---

### Section 1: The Extraction Layer (90 seconds)

**SAY:**
> "Everything starts with unstructured text — a document, a deposition, a regulatory filing. The first question is: what entities, quotes, and events are in this material, and where exactly are they?"

**DO:** Navigate to **Lantern Extract** page

**SAY:**
> "This is the extraction view. Notice that every entity has a source offset — the exact character position in the original document. This is not optional. If there's no offset, there's no item. That's a hard rule."

**DO:** Click on an extracted entity to show its source position (if offset display is visible in the current view)

**SAY:**
> "This matters because when an auditor asks 'where did this name come from?', we can point to the exact position in the source. No guessing, no 'the AI told us.'"

---

### Section 2: The Dossier Layer (90 seconds)

**SAY:**
> "Once we have structured extraction, analysts curate it into a dossier. A dossier is a working evidence file — entities, edges, claims, and evidence, all explicitly linked."

**DO:** Navigate to **Dossier Editor**

**SAY:**
> "This is not a document. It's a structured record. Every entity here links to source evidence. Every claim has a scope — is it asserted, disputed, or unresolved? We don't let analysts make claims without declaring their basis."

**DO:** Click on an entity to show its linked evidence

**SAY:**
> "Notice we're not summarizing. We're structuring. The system is designed to avoid inferring relationships without explicit evidence linkage. If evidence is insufficient, it flags that condition."

---

### Section 3: Heuristic Analysis (60 seconds)

**SAY:**
> "Now, the analysis layer. Lantern includes heuristic modules — influence hubs, funding flows, enforcement maps. But here's what's different: every heuristic has an evidence sufficiency threshold."

**DO:** Describe the heuristics architecture (these run during report generation, not as a visible panel)

**SAY:**
> "If the evidence density is too low, the heuristic won't run. It will tell you why. This is the opposite of most AI tools, which produce output regardless of confidence. We refuse to produce conclusions we can't defend."

---

### Section 4: The Report Layer (60 seconds)

**SAY:**
> "Finally, reports. When an analyst needs to share findings — with a regulator, a board, or opposing counsel — they generate a publication-ready report."

**DO:** Navigate to **Dossier Report** or show a sample report

**SAY:**
> "Every report carries an SHA-256 fingerprint of its content. If anyone modifies the report, the fingerprint breaks. This enables post-hoc integrity verification."

**DO:** Point to the fingerprint in the report header

**SAY:**
> "Reports include disclaimers about interpretation limits — what the analysis does not claim to establish. This is epistemic safety — we document the boundaries of our analysis, not just the findings."

---

### Section 5: Comparison and Verification (45 seconds)

**SAY:**
> "One more thing. Lantern supports cross-dossier comparison. If you're tracking an entity across multiple investigations, you can see where evidence converges or conflicts."

**DO:** Navigate to **Dossier Comparison** (if pre-loaded) or describe capability

**SAY:**
> "And the reference panel — accessible from anywhere — explains exactly how the system works. Procedural language only. No marketing claims."

**DO:** Open the hamburger menu and show **How Lantern Works**

---

### Closing (30 seconds)

**SAY:**
> "That's Lantern. An evidentiary record system built for defensibility. Every extraction has provenance. Every claim links to evidence. Every report has integrity verification. And when the evidence isn't sufficient, we say so."

**PAUSE**

**SAY:**
> "Questions?"

---

## Backup Points (If Asked)

**"How is this different from [X]?"**
> "Most tools optimize for speed or insight. Lantern optimizes for traceability. We're not trying to tell you what to conclude — we're giving you an evidence record you can defend."

**"Does this use AI?"**
> "The extraction layer uses deterministic, rule-based extraction — not generative AI. This is intentional. We need identical output for identical input. AI summarization erases provenance; we preserve it."

**"What about scale?"**
> "This is local-first by design. Data never leaves the user's browser. For enterprise deployment, we support on-premise installation. Scale comes from structured curation, not centralized processing."

**"Who's using this?"**
> [Insert customer discovery or pilot evidence — or state "We're in early access with [X] users in the [payor/legal/governance] space."]

---

## Demo Don'ts

- Do not claim the system "finds insights" — it structures evidence
- Do not promise conclusions — it enables defensible analysis
- Do not overstate AI capabilities — extraction is deterministic
- Do not skip the sufficiency gates — they are a key differentiator
- Do not rush the fingerprint — it's the trust anchor
