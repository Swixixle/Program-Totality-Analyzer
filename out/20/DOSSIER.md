# Program Totality Analyzer — Deterministic Dossier

**Mode:** `--no-llm` (deterministic extraction only, no LLM calls)

## 1. File Index Summary
- Files scanned: see index.json
- Self-skip: 25 analyzer files excluded

## 2. Replit Execution Profile
- **Is Replit:** True
- **Run command:** `npm run dev`
- **Language:** nodejs
- **Port:** Uses PORT env var; actual port determined at runtime. In Replit, PORT is injected.
- **Secrets (3):** DATABASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL
- **External APIs:** OpenAI

## 3. Operator Manual (Deterministic)
```json
{
  "prereqs": [
    "Node.js",
    "Python"
  ],
  "install_steps": [
    {
      "step": "Install Node dependencies",
      "command": "npm ci",
      "evidence": {
        "kind": "file_exists",
        "path": "package-lock.json",
        "snippet_hash": "053150b640a7",
        "display": "package-lock.json (file exists)"
      }
    },
    {
      "step": "Install Python dependencies",
      "command": "pip install .",
      "evidence": {
        "kind": "file_exists",
        "path": "pyproject.toml",
        "snippet_hash": "50c86b7ed8ac",
        "display": "pyproject.toml (file exists)"
      }
    }
  ],
  "config": [
    {
      "name": "DATABASE_URL",
      "purpose": "Secret referenced in code (see evidence)",
      "evidence": {
        "path": "drizzle.config.ts",
        "line_start": 3,
        "line_end": 3,
        "snippet_hash": "a19790628fbe",
        "display": "drizzle.config.ts:3"
      }
    },
    {
      "name": "AI_INTEGRATIONS_OPENAI_API_KEY",
      "purpose": "Secret referenced in code (see evidence)",
      "evidence": {
        "path": "server/replit_integrations/audio/client.ts",
        "line_start": 10,
        "line_end": 10,
        "snippet_hash": "05da5f1b1281",
        "display": "server/replit_integrations/audio/client.ts:10"
      }
    },
    {
      "name": "AI_INTEGRATIONS_OPENAI_BASE_URL",
      "purpose": "Secret referenced in code (see evidence)",
      "evidence": {
        "path": "server/replit_integrations/audio/client.ts",
        "line_start": 11,
        "line_end": 11,
        "snippet_hash": "1f70e6a77d42",
        "display": "server/replit_integrations/audio/client.ts:11"
      }
    }
  ],
  "run_dev": [
    {
      "step": "Start dev server",
      "command": "npm run dev",
      "evidence": {
        "path": "package.json",
        "line_start": 7,
        "line_end": 7,
        "snippet_hash": "fd240a9dc053",
        "display": "package.json:7"
      }
    }
  ],
  "run_prod": [
    {
      "step": "Build for production",
      "command": "npm run build",
      "evidence": {
        "path": "package.json",
        "line_start": 8,
        "line_end": 8,
        "snippet_hash": "79d8bdf275d6",
        "display": "package.json:8"
      }
    },
    {
      "step": "Start production",
      "command": "npm start",
      "evidence": {
        "path": "package.json",
        "line_start": 9,
        "line_end": 9,
        "snippet_hash": "020435ddf436",
        "display": "package.json:9"
      }
    }
  ],
  "usage_examples": [],
  "verification_steps": [],
  "common_failures": [],
  "unknowns": [
    {
      "what_is_missing": "Semantic analysis of code purpose and architecture",
      "why_it_matters": "Cannot determine system intent, integration patterns, or risk factors without LLM analysis",
      "what_evidence_needed": "Re-run without --no-llm flag for full analysis"
    }
  ],
  "missing_evidence_requests": [],
  "replit_execution_profile": {
    "run_command": "npm run dev",
    "language": "nodejs",
    "port_binding": {
      "port": null,
      "binds_all_interfaces": true,
      "uses_env_port": true,
      "evidence": [
        {
          "path": "server/index.ts",
          "line_start": 92,
          "line_end": 92,
          "snippet_hash": "75d345a78f84",
          "display": "server/index.ts:92"
        },
        {
          "path": "server/index.ts",
          "line_start": 96,
          "line_end": 96,
          "snippet_hash": "9b7206f3d09a",
          "display": "server/index.ts:96"
        }
      ]
    },
    "required_secrets": [
      {
        "name": "DATABASE_URL",
        "referenced_in": [
          {
            "path": "drizzle.config.ts",
            "line_start": 3,
            "line_end": 3,
            "snippet_hash": "a19790628fbe",
            "display": "drizzle.config.ts:3"
          },
          {
            "path": "drizzle.config.ts",
            "line_start": 12,
            "line_end": 12,
            "snippet_hash": "1005be19f14a",
            "display": "drizzle.config.ts:12"
          },
          {
            "path": "server/db.ts",
            "line_start": 7,
            "line_end": 7,
            "snippet_hash": "a19790628fbe",
            "display": "server/db.ts:7"
          },
          {
            "path": "server/db.ts",
            "line_start": 13,
            "line_end": 13,
            "snippet_hash": "111f33de9945",
            "display": "server/db.ts:13"
          }
        ]
      },
      {
        "name": "AI_INTEGRATIONS_OPENAI_API_KEY",
        "referenced_in": [
          {
            "path": "server/replit_integrations/audio/client.ts",
            "line_start": 10,
            "line_end": 10,
            "snippet_hash": "05da5f1b1281",
            "display": "server/replit_integrations/audio/client.ts:10"
          },
          {
            "path": "server/replit_integrations/chat/routes.ts",
            "line_start": 6,
            "line_end": 6,
            "snippet_hash": "05da5f1b1281",
            "display": "server/replit_integrations/chat/routes.ts:6"
          },
          {
            "path": "server/replit_integrations/image/client.ts",
            "line_start": 6,
            "line_end": 6,
            "snippet_hash": "05da5f1b1281",
            "display": "server/replit_integrations/image/client.ts:6"
          }
        ]
      },
      {
        "name": "AI_INTEGRATIONS_OPENAI_BASE_URL",
        "referenced_in": [
          {
            "path": "server/replit_integrations/audio/client.ts",
            "line_start": 11,
            "line_end": 11,
            "snippet_hash": "1f70e6a77d42",
            "display": "server/replit_integrations/audio/client.ts:11"
          },
          {
            "path": "server/replit_integrations/chat/routes.ts",
            "line_start": 7,
            "line_end": 7,
            "snippet_hash": "1f70e6a77d42",
            "display": "server/replit_integrations/chat/routes.ts:7"
          },
          {
            "path": "server/replit_integrations/image/client.ts",
            "line_start": 7,
            "line_end": 7,
            "snippet_hash": "1f70e6a77d42",
            "display": "server/replit_integrations/image/client.ts:7"
          }
        ]
      }
    ],
    "external_apis": [
      {
        "api": "OpenAI",
        "evidence_files": [
          {
            "path": "server/replit_integrations/audio/client.ts",
            "line_start": 1,
            "line_end": 1,
            "snippet_hash": "1d3dd608c3bb",
            "display": "server/replit_integrations/audio/client.ts:1"
          },
          {
            "path": "server/replit_integrations/audio/routes.ts",
            "line_start": 3,
            "line_end": 3,
            "snippet_hash": "2f87d29d3b03",
            "display": "server/replit_integrations/audio/routes.ts:3"
          },
          {
            "path": "server/replit_integrations/chat/routes.ts",
            "line_start": 2,
            "line_end": 2,
            "snippet_hash": "4db7290b0afd",
            "display": "server/replit_integrations/chat/routes.ts:2"
          },
          {
            "path": "server/replit_integrations/image/routes.ts",
            "line_start": 2,
            "line_end": 2,
            "snippet_hash": "7fd5b3abbeee",
            "display": "server/replit_integrations/image/routes.ts:2"
          },
          {
            "path": "server/replit_integrations/image/client.ts",
            "line_start": 2,
            "line_end": 2,
            "snippet_hash": "1d3dd608c3bb",
            "display": "server/replit_integrations/image/client.ts:2"
          }
        ]
      }
    ],
    "deployment_assumptions": [
      "Binds to 0.0.0.0 (all interfaces)",
      "No Dockerfile - depends on Replit runtime or manual setup",
      "Requires 3 secret(s): DATABASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL"
    ],
    "observability": {
      "logging": true,
      "health_endpoint": true,
      "evidence": [
        {
          "path": "script/build.ts",
          "line_start": 38,
          "line_end": 38,
          "snippet_hash": "2f74cc3fdab1",
          "display": "script/build.ts:38"
        },
        {
          "path": "shared/schema.ts",
          "line_start": 10,
          "line_end": 10,
          "snippet_hash": "6ccc8e5d45a7",
          "display": "shared/schema.ts:10"
        }
      ]
    },
    "limitations": [
      "Deterministic mode (--no-llm): no semantic analysis performed"
    ]
  },
  "completeness": {
    "score": 62,
    "max": 100,
    "missing": [
      "verification_steps: no step with both a runnable command and verified evidence",
      "usage_examples: no examples with meaningful descriptions"
    ],
    "deductions": [
      "-3 for 1 unknown(s)"
    ],
    "notes": "-3 for 1 unknown(s); No Dockerfile found; 1 unknown(s) reported"
  }
}
```

## 4. Limitations
- This dossier was generated in `--no-llm` mode
- No semantic analysis, claims extraction, or architecture inference was performed
- For full analysis, re-run without `--no-llm`