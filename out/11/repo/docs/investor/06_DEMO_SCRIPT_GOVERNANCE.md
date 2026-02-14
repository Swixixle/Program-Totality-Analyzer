# Nikodemus Systems Live Demo Script
## 5-7 Minutes — AI Governance / Institutional Risk Lane

---

## Setup (Before Demo)

1. Have the app running at `/`
2. Pre-load one Extract Pack with sample investigative text
3. Have one Dossier partially curated (to show mid-workflow state)
4. Clear browser console of any errors
5. Test that all navigation works

---

## Demo Flow

### Opening (30 seconds)

**SAY:**
> "Let me show you what AI governance infrastructure looks like in practice. This is not a slide deck — this is the actual system. I'm going to walk you through three things: what the system will not do, how it records uncertainty, and how an auditor would reconstruct a decision six months later."

**DO:** Start at the home page `/`

---

### Section 1: Provenance Enforcement (90 seconds)

**SAY:**
> "Most AI tools produce outputs. They don't produce evidence records. This system is different. Everything here traces to a source position."

**DO:** Navigate to **Lantern Extract** page

**SAY:**
> "This is structured extraction. Every entity, every quote, every data point has a source offset — the exact character position in the original document. If there's no offset, there's no item. That's a hard rule."

**DO:** Click on an extracted entity to show its source position (if offset display is visible in the current view)

**SAY:**
> "Why does this matter for governance? Because when a regulator asks 'where did this entity come from?', we can answer with precision. Not 'the AI told us.' The exact source position."

---

### Section 2: Explicit Limits and Refusal Logic (90 seconds)

**SAY:**
> "Now let me show you something most AI demos won't show: what the system will not do."

**DO:** Navigate to **Dossier Editor**

**SAY:**
> "This is a structured evidence record. Every claim here has a scope — is it asserted, disputed, or unresolved? Analysts cannot make claims without declaring their evidential basis."

**DO:** Click on an entity or claim to show its linked evidence

**SAY:**
> "The system is designed to avoid inferring relationships without explicit evidence linkage. If the evidence doesn't support a conclusion, the system is designed to flag that condition. It does not guess. It does not hallucinate."

**SAY:**
> "This is explicit limits as a feature, not a bug. For AI governance, the ability to document 'we cannot conclude this' is as important as the ability to say what we can."

---

### Section 3: Bounded Heuristics (60 seconds)

**SAY:**
> "The system includes heuristic analysis — influence detection, funding flow analysis, enforcement pattern mapping. But here's the governance layer: every heuristic has an evidence sufficiency threshold."

**DO:** Describe the heuristics architecture (these run during report generation, not as a visible panel)

**SAY:**
> "If the evidence density is below threshold, the heuristic is designed not to run. It documents why. Most AI systems produce output regardless of confidence. This system is designed to avoid producing conclusions it cannot support."

---

### Section 4: Audit Reconstruction (60 seconds)

**SAY:**
> "Now, the question every governance officer asks: can I reconstruct this decision six months from now?"

**DO:** Navigate to **Dossier Report** or show a sample report

**SAY:**
> "Every report carries an SHA-256 fingerprint. If anyone modifies the content after generation, the fingerprint breaks. This enables post-hoc integrity verification."

**DO:** Point to the fingerprint in the report header

**SAY:**
> "Reports are designed to include interpretation limits and disclaimers — what the analysis does not claim to establish. An auditor can review what was concluded, what was not concluded, and verify the integrity of the record."

---

### Section 5: What This Is Not (45 seconds)

**SAY:**
> "Let me be explicit about what this system is not. It is not an autonomous decision-maker. It is not an LLM. It is not generating conclusions without evidence."

**DO:** Open the hamburger menu and show **How Lantern Works**

**SAY:**
> "This reference panel explains exactly how the system operates. Procedural language. Explicit limits. No marketing claims. This is governance infrastructure — the layer that sits above AI models and enforces evidentiary discipline."

---

### Closing (30 seconds)

**SAY:**
> "That's Nikodemus. Governance infrastructure for AI risk. Provenance by design. Refusal by design. Auditability by design. Not another model — the layer that governs them."

**PAUSE**

**SAY:**
> "Questions?"

---

## Backup Points (If Asked)

**"How is this different from AI observability tools?"**
> "Observability tools watch what models do. Nikodemus governs what analysis can be concluded. We enforce provenance and sufficiency at the evidence layer, before conclusions are drawn."

**"Does this replace our AI systems?"**
> "No. Nikodemus sits above models, not instead of them. It's the governance layer that makes AI outputs auditable and defensible. Think of it as infrastructure, not a replacement."

**"What about scale?"**
> "This is local-first by design. Data never leaves the user's environment. For enterprise deployment, we support on-premise installation. Governance doesn't require centralized processing — it requires disciplined record-keeping."

**"How do we know the system won't change its behavior?"**
> "Configured for repeatability. Consistent input with consistent configuration produces consistent output. The fingerprinting layer lets you verify integrity after the fact. This is auditability, not trust."

**"Who else is using this?"**
> [Insert customer discovery or pilot evidence — or state "We're in early access with governance and risk functions at [X] organizations."]

---

## Demo Don'ts

- Do not claim the system "makes decisions" — it structures evidence for human judgment
- Do not position as competing with LLMs — it governs, not generates
- Do not overstate autonomy — human-in-the-loop is enforced
- Do not skip the refusal logic — it's a key differentiator
- Do not rush the fingerprint — it's the audit anchor
- Do not use "AI-powered" language — this is governance infrastructure
