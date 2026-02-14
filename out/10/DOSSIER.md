# ELI — System Dossier

---

## 1. Identity of Target System

**What is it?**
- ELI (Epistemic Load Index) is a framework for producing justified, auditable claims from signed artifacts. It consists of structured contracts (in the form of JSON Schemas) that define the structure of ELI output JSON, alongside reference implementations (validation scripts) to check conformance of an artifact to those schemas (README.md:L1-L3, contracts/eli-output.schema.json:L1-L157).

- The repository is scaffolded for both local Node.js usage and Replit environments. The main executable is a Node.js script which validates an example output against the canonical schema (README.md:L18-L20, validate-schema.js:L100-L149).

**What is it NOT?**
- ELI is not a cryptographic signing system; it does not sign or verify signatures itself (references/halo-integration.md:L8-L9).
- It is not a production service, but a framework and validation/reference tool for producing and checking ELI outputs (SECURITY.md:L22-L24).
- ELI does not store, adjudicate, or manage the underlying evidence, but only references it (EVIDENCE.md:L3, L32-L33).

---

## 2. Purpose & Jobs-to-be-done

**Purpose:**
- Provide a robust schema for ELI output JSON to ensure that claims and their supporting evidence can be validated, audited, and passed to other signing/receipting frameworks (README.md:L3-L7).
- Separate the logic between artifact/data validation (the contract) and external proof (receipts, signatures, etc.) (README.md:L6-L10, EVIDENCE.md:L32-L33).

**Jobs-to-be-done:**
- Define and enforce JSON schema for ELI outputs (contracts/eli-output.schema.json:L1-L157).
- Validate actual ELI output examples (examples/eli-output.sample.json:L1-L56) against the schema via a Node.js script (validate-schema.js:L100-L137).
- Integrate with external systems (like HALO RECEIPTS) by emitting deterministic, ready-to-sign JSON (references/halo-integration.md:L3-L11).

---

## 3. Capability Map

- **Schema Validation**: Validates outputs according to the strict JSON schema (validate-schema.js:L6-L99).
- **Sample Output Verification**: Confirms the provided sample is schema-compliant (validate-schema.js:L113-L137).
- **CLI Operation**: Usable both in Replit (via 'Run') and local Node.js environments (README.md:L16-L27).
- **Schema and Evidence Contract Definition**: Provides formal specifications for claims and evidence objects, their required fields and non-goals (CLAIM.md:L3-L19, EVIDENCE.md:L6-L34).
- **Integration Readiness**: Ensures outputs can be cryptographically receipted externally (references/halo-integration.md:L3-L12).

---

## 4. Architecture Snapshot

- **Core Logic**: Single-file Node.js validator (validate-schema.js:L1-L149) which loads a JSON schema and an example output, then validates and reports results.
- **Contracts**: JSON Schema file at contracts/eli-output.schema.json defines the required structure/fields (contracts/eli-output.schema.json:L1-L157).
- **Artifactual Example**: Single canonical sample at examples/eli-output.sample.json (examples/eli-output.sample.json:L1-L56).
- **Configuration**: `.replit` sets run/dev/deployment commands; `replit.nix` defines required packages (Node.js 20, jq) (.replit:L1-L7, replit.nix:L2-L4).
- **No Server/Daemon**: Purely CLI/scripted, no persistent runtime or open server.
- **No Database/Storage Layer**: Does not persist data, only reads sample and schema files.

---

## 5. How to Use the Target System

#### Prerequisites

1. **Node.js 20** and **jq** must be available (replit.nix:L3-L4).

#### Local Installation

1. *Provision Node.js 20 and jq dependencies*  
   - If on Replit, this is automatic.  
   - If local, manually install Node.js v20 and jq.  
     - _Evidence: replit.nix:L3-L4_

2. *No explicit npm install required* (No node_modules, dependencies, or package.json are needed.)  
   - _Evidence: README.md:L32-L35_

#### Configuration

- **Run Command (dev)**:  
  - To launch: `node validate-schema.js` (.replit:L1)
- **Nix Channel**:  
  - NixOS packages taken from `stable-23_11` (.replit:L4)
- **Deployment run command**:  
  - Run: `sh -c "node validate-schema.js"` (.replit:L6-L7)

#### Running the Validator

**Replit**

1. Open the repository in your Replit account
2. Click the "Run" button  
   - This executes `node validate-schema.js` (.replit:L1, README.md:L16-L18)

**Local CLI**

1. Ensure you're in the project's root directory
2. Run:  
   ```
   node validate-schema.js
   ```
   - _Evidence: README.md:L27_

#### What Happens

- Loads the schema `contracts/eli-output.schema.json` and the sample output `examples/eli-output.sample.json`
- Validates the sample against the schema
- Prints **Validation PASSED** or **FAILED** with details (validate-schema.js:L113-L135).

#### What to Look For

- If sample is valid, prints summary fields of the output (verdict, confidence, evidence count, safety risk) (validate-schema.js:L127-L130).
- If validation fails, lists all schema errors and exits with code 1 (validate-schema.js:L132-L135).

#### Usage Example

Validate the schema via terminal:
```
node validate-schema.js
```

#### Verification

- The sample is checked against the schema (validate-schema.js:L121).
- Success is indicated by "✓ Validation PASSED" (validate-schema.js:L124).
- Review displayed sample summary as a correctness cross-check.

#### Common Failures & Fixes

- **Failure: "Validation script reports schema errors"**  
  *Cause*: The sample output doesn't match the schema.  
  *Remedy*: Update either the sample file or the schema definition for consistency.

- **Failure: "Error: node: command not found"**  
  *Cause*: Node.js v20 not installed or not accessible in `$PATH`.  
  *Remedy*: Install Node.js 20.

---

## 6. Integration Surface

- **No external APIs**: Operates on local files only (validate-schema.js:L113-L115).
- **Artifacts**: Produces deterministic JSON artifacts eligible for external signing/receipting (references/halo-integration.md:L3-L12).
- **Contract Format**: JSON Schema (contracts/eli-output.schema.json:L1-L157).
- **Supported Evidence Pointers**: Schema allows evidence sections to reference URLs/hashes, per EVIDENCE.md:L10-L15.

---

## 7. Data & Security Posture

- **Data Storage**: Does not persist any user or claim data. Only reads static example+schema files (validate-schema.js:L114-L115).
- **Secrets**: No secrets handled or required as input.  
- **Encryption**: None; all artifacts are plain JSON, only hashed fields as identifiers.
- **Authentication/Authorization**: None; unguarded script operation.  
- **Security Guarantees**: None for this repository or validator; scope is dev/testing only (SECURITY.md:L22-L24).
- **Evidence/Receipt Signing**: To be handled externally (references/halo-integration.md:L8-L9).

---

## 8. Operational Reality

- **Stateless**: Can be run repeatedly without priming or teardown.
- **No Background Services**: No daemon/process persists; script runs, validates, and exits.
- **Portability**: Runs on any OS with Node.js 20 (README.md:L27).
- **No Database/Migrations**: Needs only schema and example JSON present.
- **No Lifecycle Management**: No deploy/upgrade/rollback process.

---

## 9. Maintainability & Change Risk

- **Maintainability**:  
  - Easy schema evolution (JSON Schema is a stable standard).
  - The validator is simple, no dependencies or subtle state.
- **Schema Change Impact**:  
  - Adding/changing required fields in `eli-output.schema.json` will break compatibility with older sample outputs and any downstream consumers (contracts/eli-output.schema.json:L7-L16).
- **Validator Script Logic**:  
  - Pure JS, easy to patch, but lacks modularity (all validation in a single file) (validate-schema.js:L6-L99).
- **External Integration**:  
  - Contracts with signing/receipting systems depend on deterministic, schema-stable output format (references/halo-integration.md:L10-L11).

---

## 10. Replit Execution Profile

- **Nix Environment**: Installs Node.js 20 and jq (replit.nix:L3-L4).
- **Run Command**: `"node validate-schema.js"` (.replit:L1).
- **Deployment Command**: `["sh", "-c", "node validate-schema.js"]` (.replit:L7).
- **No Ports Exposed**: Not a network service, no inbound/outbound sockets (.replit:L1, README.md:L18).
- **No secrets required by environment**: None referenced in .replit or code.

---

## 11. Unknowns / Missing Evidence

- **Exact schema validation options/edge case handling**  
  - The validator is custom but does not fully conform to JSON Schema Draft 2020-12, so behavior on complex schemas (e.g., allOf, oneOf, $ref) is limited; the support is not clearly documented.
  - Unknown — evidence needed: Integration tests with varied/complex ELI outputs.

- **Extensibility or additional config**  
  - Lack of presence of optional environment variables, .env, advanced configuration, or runtime parameterization.
  - Unknown — evidence needed: Any .env, config.json, or other configuration source.

- **Support for multiple versions/schemas**  
  - No logic or config for choosing schema version or managing migration/compatibility.
  - Unknown — evidence needed: Version handling code or multi-schema test artifacts.

---

## 12. Receipts (Evidence Index)

- **README.md:L1-L36** (System identity & usage)
- **CLAIM.md:L3-L19** (Claim/evidence separation)
- **EVIDENCE.md:L3-L34** (Evidence contract)
- **references/halo-integration.md:L3-L23** (Integration boundaries)
- **contracts/eli-output.schema.json:L1-L157** (Schema contract)
- **examples/eli-output.sample.json:L1-L56** (Reference output)
- **.replit:L1-L7** (Run/dev/deploy config)
- **replit.nix:L3-L4** (Runtime deps)
- **validate-schema.js:L1-L149** (Validation logic/source)
- **SECURITY.md:L22-L24** (Security non-goals)

---

# End of Dossier