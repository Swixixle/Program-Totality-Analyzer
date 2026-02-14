# Kill Switch Behavior

> **Security Control Documentation**

## Overview

The kill switch is an **irreversible** control that permanently disables all interpretation and observation capabilities for a receipt.

## Behavior When Engaged

When `kill_switch_engaged: true`:

| Feature | Behavior |
|---------|----------|
| Interpretations | All existing hidden; new ones blocked |
| LLM Observations | All existing hidden; new ones blocked |
| Tri-sensor Analysis | Blocked |
| Multi-model Observe | Blocked |
| Research Records | Blocked (no new records created) |
| Proof Pack | Still available (integrity proofs unaffected) |
| Public Verify | Still available (verification unaffected) |

## API Response

Attempting to observe a kill-switched receipt returns:

```json
{
  "schema": "ai-receipt/error/1.0",
  "error": {
    "code": "KILL_SWITCH_ENGAGED",
    "message": "Kill switch engaged for this receipt. Observations are permanently disabled."
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

HTTP Status: `403 Forbidden`

## Engaging the Kill Switch

```bash
curl -X POST https://your-domain/api/receipts/{receiptId}/kill \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**WARNING: This action is IRREVERSIBLE.**

## Security Audit

Kill switch engagement is logged as a security event:
- Event type: `SECURITY_KILL_SWITCH_ENGAGED`
- Receipt ID is redacted (unless synthetic pattern)
- Timestamp recorded
- No PII included

## When to Use

Consider engaging the kill switch when:
1. A receipt contains sensitive information that should not be analyzed
2. A receipt was created erroneously
3. Regulatory or legal requirements mandate sealing
4. User requests permanent privacy protection

## What Remains Available

After kill switch engagement:
- Verification status (VERIFIED/PARTIALLY_VERIFIED/UNVERIFIED)
- Integrity proofs (hashes, signature, chain)
- Proof pack retrieval
- Receipt metadata (platform, captured_at)

## What Becomes Unavailable

After kill switch engagement:
- LLM observations (existing hidden, new blocked)
- Interpretations (existing hidden, new blocked)
- Research record creation
- Forensic analysis additions
