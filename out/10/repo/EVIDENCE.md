# ELI Evidence Contract — v0.1

ELI does not store raw evidence. ELI stores pointers to evidence and the
minimum verification metadata required to check it.

## Evidence Object (conceptual)

An evidence item MUST include:

- kind: receipt | file | url | transcript | other
- locator: where to find it (path, URL, or opaque reference)
- hash:
  - alg: sha256 (v0.1 default)
  - value: hex digest
- signature (optional but supported):
  - scheme: openssh-ssh-keygen-y
  - namespace: halo-receipt (or other explicit namespace)
  - signer_id: string (matches allowed_signers identity)
  - sig_locator: where the signature file is stored
  - allowed_signers_locator: where the allowed_signers file is stored
- captured_at: ISO-8601 timestamp (optional but recommended)

## Verification Expectations

- Hash verification is REQUIRED when a hash is present.
- Signature verification is REQUIRED when signature fields are present.
- If verification cannot be performed, the evidence item must be treated as
  "unverified" and any dependent claims must downgrade inference level.

## Non-Goals

- ELI does not define a universal truth system.
- ELI does not adjudicate credibility beyond verification metadata.
- ELI does not require the evidence content to be public.
