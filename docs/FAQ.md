# Frequently Asked Questions

## General

### What is Repository Reconnaissance (RR)?

RR is a static analysis system that generates operational documentation and readiness assessments for software projects. It analyzes source code, configuration files, and infrastructure-as-code to produce evidence-backed dossiers explaining what a system is, how to run it, what it needs, and what remains unknown.

### Is this open source?

No. This repository contains public documentation and interface specifications, but the core analysis methods and proprietary algorithms are not open-sourced. See [docs/SECURITY_AND_DISCLOSURE.md](SECURITY_AND_DISCLOSURE.md) for details.

### How is this different from other static analysis tools?

RR focuses on **operational readiness** rather than security scanning or code quality metrics. Key differences:

* **Evidence-first** — every claim cites file:line references with cryptographic hashes
* **Operator-focused** — outputs are designed for DevOps, SRE, and compliance teams, not just developers
* **Multi-artifact** — analyzes application code, infrastructure, data pipelines, ML workflows, and policy files in a unified model
* **Explicit uncertainty** — findings are labeled as EVIDENCED, INFERRED, or UNKNOWN with clear reasoning

### What languages and frameworks does RR support?

RR analyzes multiple artifact types:

* **Application code**: TypeScript, JavaScript, Python, Go, Java, and more
* **Infrastructure**: Terraform, Kubernetes, Docker
* **Data pipelines**: dbt models, SQL scripts
* **ML workflows**: Training scripts, model configs, prompt templates
* **Policy-as-code**: OPA/Rego policies

See [docs/artifact-types.md](artifact-types.md) for complete coverage.

## Capabilities

### Does RR replace manual code review?

No. RR provides **structured operational documentation** to accelerate reviews, but it does not replace human judgment. It's designed to augment reviewers by:

* Extracting operational requirements automatically
* Highlighting gaps and unknowns explicitly
* Providing evidence trails for audit purposes
* Standardizing documentation across projects

### Can RR find security vulnerabilities?

RR is **not a security scanner**. It reports structural observations and operational posture, not vulnerability detection. For security scanning, use dedicated tools like:

* Snyk, Dependabot for dependency vulnerabilities
* CodeQL, Semgrep for code pattern analysis
* Cloud-native scanners for infrastructure misconfigurations

RR can help identify **operational security gaps** (missing auth config, exposed credentials in env vars), but this is secondary to its primary operational focus.

### Does RR run my code?

No. RR performs **static analysis only**—it reads source files, configuration, and lockfiles but never executes application code. This means:

* No runtime behavior observation
* No performance profiling
* No integration testing
* No side effects or resource consumption

### What does "evidence-backed" mean?

Every RR finding includes:

* **File path and line number** — where the evidence was found
* **Snippet hash** — SHA-256 hash of the extracted code snippet
* **Confidence level** — EVIDENCED (hash-verified), INFERRED (pattern-matched), or UNKNOWN

You can verify any claim by checking the cited file location and recomputing the hash.

## Deployment & Integration

### How do I get started?

1. **Explore capabilities** — read [PUBLIC.md](../PUBLIC.md) for overview
2. **Review installation** — see [docs/QUICKSTART.md](QUICKSTART.md) for setup
3. **Try CLI mode** — analyze a test repository locally
4. **Request a demo** — contact us via [CONTACT.md](../CONTACT.md) for pilot access

### Can I run RR on private repositories?

Yes. RR supports:

* **Local analysis** — clone the repo locally and analyze without uploading
* **Self-hosted deployment** — run RR in your own infrastructure
* **GitHub App integration** — webhook-triggered analysis with GitHub token authentication

See [docs/DEPLOYMENT.md](DEPLOYMENT.md) for private repository setup.

### Does RR send my code to external services?

**Not by default.** RR operates in two modes:

* **Deterministic mode** (`--no-llm`) — 100% local, no external API calls, reproducible outputs
* **LLM-enhanced mode** — optional semantic analysis using OpenAI API (configurable endpoint)

You control which mode to use. For air-gapped or high-security environments, use deterministic mode only.

### How does CI/CD integration work?

RR integrates via **GitHub webhooks**:

1. Configure webhook pointing to your RR instance
2. Push or open a PR in your repository
3. RR automatically clones at the commit SHA and runs analysis
4. Results appear in the web UI at `/ci` with searchable feed

See [docs/API.md](API.md) for webhook setup and endpoint documentation.

## Outputs & Results

### What files does RR generate?

* **`operate.json`** — operator dashboard with boot/integrate/deploy commands, readiness scores, operational gaps
* **`DOSSIER.md`** — human-readable markdown summary
* **`claims.json`** — verifiable claims with evidence and confidence scores
* **`coverage.json`** — scan metadata and file index
* **`replit_profile.json`** — Replit-specific execution profile (only in Replit mode)

See [docs/OUTPUT_CONTRACTS.md](OUTPUT_CONTRACTS.md) for schema details.

### How accurate are the results?

RR provides **evidence scope**, not accuracy guarantees:

* **EVIDENCED** findings are anchored to hash-verified source snippets
* **INFERRED** findings are pattern-matched with confidence scores
* **UNKNOWN** findings are explicitly labeled with reasoning

RR does not claim to be "correct" about what the code does at runtime—it reports what it can observe in static artifacts.

### Can I customize the analysis?

Customization options include:

* **Scoping** — analyze specific subdirectories with `--root` flag
* **Mode selection** — deterministic vs LLM-enhanced
* **Artifact types** — filter by file patterns or categories
* **Output formats** — JSON, Markdown, or both

For advanced customization (custom artifact types, specialized extraction), contact us for pilot program access.

## Pricing & Licensing

### Is RR free?

This public documentation and evaluation CLI are available for non-commercial evaluation. Production deployment and commercial use require a license. Contact us via [CONTACT.md](../CONTACT.md) for pricing.

### What's included in a pilot program?

Pilot programs include:

* Evaluation license for limited scope (e.g., up to 10 repositories)
* Integration support and technical guidance
* Custom configuration for your tech stack
* Feedback collection and feature prioritization

### What does a production license include?

Production licenses include:

* Unlimited repository analysis
* Self-hosted or managed deployment options
* Ongoing updates and support
* SLA guarantees for uptime and response time
* Customization for specialized artifact types

## Support

### How do I report a bug?

If you encounter issues:

1. Check [docs/QUICKSTART.md](QUICKSTART.md) troubleshooting section
2. Review [docs/OPERATIONS.md](OPERATIONS.md) for common issues
3. For persistent issues, contact us via [CONTACT.md](../CONTACT.md) with:
   - Error message and logs
   - Repository characteristics (language, size, structure)
   - RR version and deployment environment

### How do I request a feature?

Feature requests are handled through the inquiry process:

1. Send request to contact email in [CONTACT.md](../CONTACT.md)
2. Include:
   - Use case description
   - Expected behavior
   - Business impact if feature is unavailable
3. We'll respond with feasibility assessment and timeline

Priority is given to pilot program participants and production license holders.

### Where can I learn more?

* **Capability overview**: [PUBLIC.md](../PUBLIC.md)
* **Installation guide**: [docs/QUICKSTART.md](QUICKSTART.md)
* **API reference**: [docs/API.md](API.md)
* **Deployment patterns**: [docs/DEPLOYMENT.md](DEPLOYMENT.md)
* **Security policy**: [docs/SECURITY_AND_DISCLOSURE.md](SECURITY_AND_DISCLOSURE.md)
