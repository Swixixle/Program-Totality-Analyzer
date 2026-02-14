# Evidence Walkthrough Demo (Exhibit, Not Feature)

This demo is an **exhibit**: a fixed evidence artifact and a disciplined walkthrough of what can and cannot be concluded from it.

**This demo does not assert truth.**  
It does not infer intent, authorship, legitimacy, or safety.  
It shows how reasoning changes under different interpretive lenses *given a verified artifact*.

---

## What this is

- A minimal evidence object (`evidence.json`) shaped like a HALO receipt.
- A structured interpretation (`interpretation.md`) that separates:
  - **What is known**
  - **What is not known**
  - **What would require assumptions**
- A "lens discipline" that prevents semantic drift.

---

## What this is NOT

This demo does **not**:
- claim the content is true, accurate, ethical, or safe
- identify a real-world person or organization
- prove authorship or ownership
- prove legitimacy of the signer's actions
- provide a trusted timestamp
- provide a confidence score or "AI judgment"

---

## How to use this demo

### Step 1 — Treat `evidence.json` as an *exhibit*
Read it as you would a logged artifact:
- it is a structured claim that **some bytes existed**
- and that (in a real pipeline) those bytes would be **tamper-evident once signed**

### Step 2 — (Optional) Swap in a real HALO receipt
If you want this exhibit to be **cryptographically verifiable**, replace `evidence.json` with an actual receipt produced by HALO-RECEIPTS, and verify it there.

This demo intentionally keeps Lantern out of cryptographic verification. Lantern is an interpretive framework.

Suggested workflow:

1. In HALO-RECEIPTS, sign + verify a receipt:
   - produces `*.payload` and `*.payload.sig`
2. Copy the receipt JSON into this folder as `evidence.json`
3. Keep verification outputs out of Lantern repo unless explicitly needed

### Step 3 — Read `interpretation.md`
That file is the "Lantern move":
- it refuses meaning inflation
- it documents inference boundaries
- it compares lenses without changing the evidence

---

## Why this exists

Most "AI demos" try to impress.

Lantern demos try to **withstand cross-examination**.

The goal is not persuasion.  
The goal is **stable reasoning under constraints**.
