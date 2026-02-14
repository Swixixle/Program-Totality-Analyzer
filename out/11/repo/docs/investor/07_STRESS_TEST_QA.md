# Nikodemus Systems: Stress-Test Q&A
## Hostile Questions with Defensible Answers

These responses are designed for skeptical audiences: regulators, risk committees, compliance officers, insurers, and opposing counsel. Answers should be calm, precise, and boring in the best way.

---

## Category 1: Limits and Liability

### Q: What does this system NOT do?

**A:** Nikodemus does not make decisions. It does not generate conclusions without evidence. It does not auto-infer relationships without explicit linkage. It does not operate autonomously — every output is produced through analyst interaction. It is an evidentiary record system, not a decision engine.

---

### Q: Where does liability stop?

**A:** Nikodemus is a tool that structures and records evidence. Liability for decisions made using that evidence remains with the human decision-maker and their institution. The system does not make recommendations, does not score outcomes, and does not prescribe actions. It produces structured records that humans interpret.

---

### Q: How could this be misused?

**A:** Any evidentiary tool can be misused if an operator selectively presents evidence or ignores documented limits. Nikodemus mitigates this by:
- Requiring explicit evidence linkage for all claims
- Documenting what the system cannot conclude
- Producing fingerprinted reports that can be verified for tampering
- Logging the provenance of all extractions

Misuse would require deliberate circumvention of these safeguards, which would be visible in the audit trail.

---

### Q: If I use this and something goes wrong, can I blame the software?

**A:** No. Nikodemus is designed to support human judgment, not replace it. The system explicitly documents its limits and does not claim authority over decisions. Any institution using Nikodemus remains responsible for how they interpret and act on the structured evidence it produces.

---

## Category 2: Technical Integrity

### Q: How do I know the output is accurate?

**A:** Every extraction traces to an exact source position in the original document. You can verify any entity, quote, or data point by checking its offset against the source material. The system does not summarize or paraphrase — it structures what is present in the source.

---

### Q: What if the source document is wrong?

**A:** Nikodemus extracts what is in the source. It does not validate the truth of source content. If a source document contains errors, those errors will be faithfully extracted with provenance. The system is designed for traceability, not fact-checking.

---

### Q: How do I know the report hasn't been tampered with?

**A:** Every report carries an SHA-256 fingerprint of its content. If any part of the report is modified after generation, the fingerprint will no longer match. This enables post-hoc integrity verification by any party with access to the fingerprint.

---

### Q: Is this deterministic? Will I get the same output every time?

**A:** The system is configured for repeatability. Given the same input, same configuration, and same version, the output is designed to be consistent. We use hash-based stable IDs rather than random identifiers to support reproducibility.

---

### Q: What happens if the extraction misses something?

**A:** The system extracts what its rules identify. It does not claim to extract everything. Analysts are expected to review extractions and add entities or claims that the automated layer did not capture. The system supports human augmentation, not replacement.

---

## Category 3: Governance and Auditability

### Q: How would an auditor reconstruct a decision made with this system?

**A:** An auditor would:
1. Review the dossier containing entities, claims, and evidence linkages
2. Verify each claim's provenance against source documents using offsets
3. Check the report fingerprint to confirm integrity
4. Review documented interpretation limits to understand what was not concluded

All of this is recorded and exportable.

---

### Q: What happens when the system doesn't know?

**A:** The system is designed to document uncertainty. Claims can be marked as UNRESOLVED. Heuristics are designed to gate on evidence sufficiency thresholds — if evidence density is too low, the heuristic documents why it did not run. The system does not guess.

---

### Q: Does this system use AI?

**A:** The extraction layer uses rule-based, deterministic methods — not generative AI. This is intentional. Generative AI erases provenance and produces variable outputs. Nikodemus is designed for traceability and reproducibility, which requires deterministic processing.

---

### Q: What about hallucination?

**A:** Nikodemus does not hallucinate because it does not generate. It extracts and structures what is present in source documents. Every output traces to a source position. If there is no source, there is no output.

---

### Q: How does this compare to using ChatGPT or similar tools?

**A:** LLMs generate plausible text. Nikodemus structures source evidence. LLMs do not preserve provenance — you cannot trace a summary back to exact source positions. Nikodemus requires provenance for every item. They serve different purposes: LLMs for generation, Nikodemus for evidentiary record-keeping.

---

## Category 4: Deployment and Control

### Q: Where does my data go?

**A:** Nowhere. Nikodemus is local-first by design. All data remains in the user's browser storage. There are no network calls for data transmission. For enterprise deployment, on-premise installation is supported. Data sovereignty is preserved.

---

### Q: Can you see my data?

**A:** No. The system runs entirely in the user's environment. There is no telemetry, no cloud storage, and no data exfiltration. We cannot access user data because the architecture does not transmit it.

---

### Q: What if I need to share evidence across teams?

**A:** Dossiers can be exported as portable JSON files and imported by other users. The import policy is binary: if a pack already exists, it is skipped — no field-level merging that could corrupt provenance. This preserves integrity across transfers.

---

### Q: What regulatory frameworks does this support?

**A:** Nikodemus is designed to align with emerging governance requirements for traceability, reproducibility, and contestability — as emphasized in frameworks like NIST AI RMF and directional requirements in the EU AI Act. It is not certified against specific regulations but is architecturally aligned with their principles.

---

## Category 5: Edge Cases

### Q: What if two analysts reach different conclusions from the same dossier?

**A:** That is expected and appropriate. Nikodemus produces structured evidence records, not conclusions. Different analysts may interpret the same evidence differently. The system records what evidence was present, not what conclusion should be drawn. Human judgment remains the interpretive layer.

---

### Q: What if I need to update a dossier after a report is generated?

**A:** Dossiers can be updated at any time. However, any previously generated report retains its original fingerprint. If a dossier is updated and a new report is generated, the new report will have a new fingerprint. The audit trail shows which version of the dossier was used for each report.

---

### Q: What if the heuristics are wrong?

**A:** Heuristics are analytical tools, not truth engines. They identify structural patterns in the evidence — influence concentration, funding flows, enforcement actions. Whether those patterns are meaningful is a judgment call for the analyst. The system documents the evidence density and thresholds used, so the basis for any heuristic output is transparent.

---

### Q: Can this be used for surveillance or targeting?

**A:** Nikodemus is designed for evidentiary analysis, not surveillance. It operates on documents provided by the user — it does not collect data, monitor individuals, or aggregate information from external sources. Use for surveillance would require external data collection systems, which are outside the scope of this tool.

---

## Meta-Guidance for Hostile Audiences

**Posture:** Calm, precise, boring. Do not oversell. Do not claim the system solves problems it doesn't address.

**Key phrases to use:**
- "The system is designed to..."
- "That is expected and appropriate..."
- "Liability remains with the human decision-maker..."
- "The system documents, it does not decide..."

**Key phrases to avoid:**
- "AI-powered"
- "Intelligent"
- "Autonomous"
- "Recommends"
- "Decides"

**If you don't know the answer:** Say so. "That's outside the scope of this system" or "I would need to verify that before answering" is always preferable to speculation.
