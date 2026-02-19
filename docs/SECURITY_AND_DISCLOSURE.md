# Security & Disclosure Policy

## Disclosure boundaries

This repository contains:

* **Public documentation** — capability descriptions, use cases, and integration patterns
* **Interface specifications** — API endpoints, data schemas, and output formats
* **Operational guidance** — installation, deployment, and configuration procedures

This repository does **not** disclose:

* **Core analysis algorithms** — proprietary extraction, inference, and evidence-chaining methods
* **Threat models and attack scenarios** — security bypass patterns or vulnerability exploitation details
* **Cryptographic internals** — key handling, signature schemes, or canonicalization implementations
* **Database schema internals** — beyond high-level entity descriptions
* **Performance optimization strategies** — specific architectural invariants or scaling methods

## Intellectual property notice

**This repository does not constitute an open-source release of the core intellectual property.**

The Repository Reconnaissance's public documentation is provided to:

* Help potential users understand capabilities and value propositions
* Enable integration planning and technical evaluation
* Support pilot programs and proof-of-concept deployments
* Facilitate inquiry and demo requests

The documentation and code samples provided here do not grant rights to:

* Reproduce core analysis methods
* Reverse-engineer proprietary algorithms
* Create derivative competitive products
* Redistribute internal implementation details

## Security reporting

If you discover a security vulnerability in:

* **Public-facing APIs or webhooks** — report to the contact email in CONTACT.md with subject line: `[SECURITY] Vulnerability Report`
* **Documentation that inadvertently exposes sensitive implementation details** — report using the same process

Include:

1. Detailed description of the vulnerability
2. Steps to reproduce (if applicable)
3. Potential impact assessment
4. Your contact information for follow-up

We aim to respond to security reports within 48 hours and provide remediation timelines within 5 business days.

## What we protect

The following are considered proprietary and confidential:

* **Analysis heuristics** — pattern matching strategies, confidence scoring algorithms, evidence ranking methods
* **LLM integration details** — prompt engineering, model selection, interpretation strategies
* **Performance optimizations** — caching strategies, parallelization methods, resource allocation
* **Error handling patterns** — specific failure modes, recovery strategies, edge case handling
* **Threat countermeasures** — specific protections against analysis evasion or resource exhaustion attacks

## What we share

We freely share:

* **Capability descriptions** — what the system can analyze and extract
* **Output formats** — JSON schemas, evidence structures, readiness scoring models
* **Integration patterns** — how to trigger analysis, consume results, and integrate into CI/CD
* **Operational best practices** — deployment patterns, monitoring strategies, scaling guidance
* **Trust boundaries** — explicit limitations and uncertainty handling

## Responsible disclosure for pilots and evaluations

If you are participating in a pilot or evaluation:

* **Do not share internal documentation** provided during evaluation with third parties
* **Do not reverse-engineer** proprietary analysis methods
* **Do not benchmark** without explicit written permission
* **Do not publish** performance data, comparison studies, or detailed technical findings

Pilot participants receive additional confidential documentation under NDA. Contact us for evaluation access.

## Redaction policy for public examples

When providing examples or sample outputs:

* **Redact proprietary code snippets** — use placeholder content or simplified examples
* **Anonymize repository references** — do not reveal client project names or private repo URLs
* **Generalize patterns** — describe capabilities without exposing implementation-specific details
* **Limit output samples** — show structure and schema, not full production artifacts

## Questions about disclosure

If you're unsure whether something should be publicly shared:

* **Default to not sharing** — if it feels like internal IP, it probably is
* **Ask first** — contact us at the email in CONTACT.md before posting or sharing
* **Check this policy** — review the "What we protect" vs "What we share" sections above

## Updates to this policy

This policy is maintained as part of the public repository and updated as disclosure boundaries evolve. Check the git history for changes.

Last updated: 2026-02-17
