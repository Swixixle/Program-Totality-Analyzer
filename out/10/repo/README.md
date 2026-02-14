# ELI — Epistemic Load Index

ELI is a framework for producing justified, auditable claims from signed artifacts.

It separates:
- cryptographic proof (what is provably unchanged and who signed it)
- from inference (what conclusions can reasonably be drawn)

ELI is designed to work with external signing and receipt systems
(e.g. HALO-RECEIPTS) rather than replacing them.

## Quick Start

### Run in Replit

This repository is configured to run in Replit. Simply:
1. Open this repository in Replit
2. Click "Run" to validate the ELI schema and sample output

The validation script checks that the sample ELI output conforms to the JSON schema contract.

### Local Usage

To validate the schema locally:

```bash
node validate-schema.js
```

## Repository Structure

- `contracts/` - JSON Schema definitions for ELI outputs
- `examples/` - Sample ELI output files
- `references/` - Integration documentation (e.g., HALO-RECEIPTS)

Status: early scaffold.
