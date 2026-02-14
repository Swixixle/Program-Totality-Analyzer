# ELI ↔ HALO Integration Boundary

ELI produces structured, schema-valid outputs that may be cryptographically
receipted by HALO-RECEIPTS.

## Contract

- ELI does NOT perform signing
- ELI does NOT manage keys
- ELI emits a deterministic JSON artifact
- HALO derives and signs receipts against that artifact

## Eligible for Receipt

- examples/eli-output.sample.json
- Future ELI outputs that conform to:
  contracts/eli-output.schema.json

## Receipt Subject Mapping (Draft)

- subject.type: "eli-output"
- subject.content_type: "application/json"
- subject.byte_length: computed by HALO
