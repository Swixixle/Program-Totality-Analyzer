# Independent Verification Guide

This document explains how a third party can verify the integrity of this share pack using only standard tools — no access to source code or secrets required.

## Prerequisites

- Python 3.x OR Node.js 16+
- Standard shell with `grep`

## 1. Verify EVENT_LOG Chain Integrity

The EVENT_LOG.jsonl file is a hash-chained append-only log. Each line contains:

- `prev_line_hash`: The `line_hash` of the previous line (or "GENESIS" for the first line)
- `line_hash`: SHA256 hash of `prev_line_hash` concatenated with the canonicalized line content

### Hash Formula

```
line_without_hashes = {ts, event_type, summary, evidence_ptrs}  # sorted keys
canonical = JSON.stringify(line_without_hashes, keys sorted)
line_hash = SHA256(prev_line_hash + canonical)
```

### Python Verification Script

Save this as `verify_chain.py` and run with `python verify_chain.py`:

```python
#!/usr/bin/env python3
import json
import hashlib

def canonicalize(obj):
    return json.dumps(obj, sort_keys=True, separators=(',', ':'))

def verify_chain(log_path):
    with open(log_path, 'r') as f:
        lines = [l.strip() for l in f if l.strip()]
    
    expected_prev = 'GENESIS'
    for i, line in enumerate(lines, 1):
        event = json.loads(line)
        
        # Check prev_line_hash
        if event.get('prev_line_hash') != expected_prev:
            print(f"FAIL: Line {i} prev_line_hash mismatch")
            print(f"  Expected: {expected_prev}")
            print(f"  Got: {event.get('prev_line_hash')}")
            return False
        
        # Compute expected line_hash
        line_data = {
            'ts': event['ts'],
            'event_type': event['event_type'],
            'summary': event['summary'],
            'evidence_ptrs': event['evidence_ptrs']
        }
        canonical = expected_prev + canonicalize(line_data)
        computed_hash = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
        
        if computed_hash != event.get('line_hash'):
            print(f"FAIL: Line {i} line_hash mismatch")
            print(f"  Expected: {computed_hash}")
            print(f"  Got: {event.get('line_hash')}")
            return False
        
        expected_prev = event['line_hash']
    
    print(f"PASS: All {len(lines)} lines verified")
    print(f"Last hash: {expected_prev}")
    return True

if __name__ == '__main__':
    verify_chain('forensic_state/EVENT_LOG.jsonl')
```

### Node.js Verification One-Liner

```bash
node -e "
const fs = require('fs');
const crypto = require('crypto');
const lines = fs.readFileSync('forensic_state/EVENT_LOG.jsonl', 'utf8').trim().split('\n');
let prev = 'GENESIS';
for (let i = 0; i < lines.length; i++) {
  const e = JSON.parse(lines[i]);
  if (e.prev_line_hash !== prev) { console.log('FAIL: Line', i+1, 'prev mismatch'); process.exit(1); }
  const data = {ts: e.ts, event_type: e.event_type, summary: e.summary, evidence_ptrs: e.evidence_ptrs};
  const sorted = Object.keys(data).sort().reduce((o,k) => (o[k]=data[k],o), {});
  const hash = crypto.createHash('sha256').update(prev + JSON.stringify(sorted)).digest('hex');
  if (hash !== e.line_hash) { console.log('FAIL: Line', i+1, 'hash mismatch'); process.exit(1); }
  prev = e.line_hash;
}
console.log('PASS:', lines.length, 'lines verified');
console.log('Last hash:', prev);
"
```

### Expected Result

```
PASS: All N lines verified
Last hash: <64-character hex string>
```

If any line fails, the chain has been tampered with.

---

## 2. Verify No Forbidden Strings (No IP Leak)

Run these grep commands from the share_pack directory. **PASS means 0 matches.**

### Check for Deployment URLs

```bash
grep -ri "\.replit\.app" .
grep -ri "\.replit\.dev" .
grep -ri "replit\.com" .
```

### Check for API Keys

```bash
grep -ri "x-api-key:" . | grep -v "\[API_KEY_REDACTED\]"
grep -i "OPENAI_API_KEY" . | grep -v "\[SECRET"
```

### Check for IP Addresses

```bash
grep -rE "\b[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b" . | grep -v "\[IP_REDACTED\]"
```

### Check for Private Keys

```bash
grep -r "BEGIN PRIVATE KEY" .
grep -r "BEGIN RSA PRIVATE KEY" .
grep -r "BEGIN EC PRIVATE KEY" .
```

### Expected Result

All commands should return **0 matches** (empty output).

Exception: `REDACTION_RULES.md` documents the patterns themselves and is exempt from this check.

---

## 3. Verify Snapshot Consistency

### Check SNAPSHOT.txt Timestamp

The SNAPSHOT.txt timestamp should be >= the latest EVENT_LOG.jsonl event timestamp.

```bash
# Get SNAPSHOT.txt timestamp
grep "Generated:" forensic_state/SNAPSHOT.txt

# Get last EVENT_LOG.jsonl timestamp
tail -1 forensic_state/EVENT_LOG.jsonl | python3 -c "import sys,json; print(json.load(sys.stdin)['ts'])"
```

### Check STATE_MANIFEST.md

1. The "Current Phase" should match SNAPSHOT.txt phase
2. The "Last Updated" timestamp should be >= last event timestamp

```bash
grep "Current Phase" forensic_state/STATE_MANIFEST.md
grep "Last Updated" forensic_state/STATE_MANIFEST.md
```

### Check Last Hash Reference

The last line_hash from EVENT_LOG.jsonl should appear in SNAPSHOT.txt:

```bash
LAST_HASH=$(tail -1 forensic_state/EVENT_LOG.jsonl | python3 -c "import sys,json; print(json.load(sys.stdin)['line_hash'])")
grep "$LAST_HASH" forensic_state/SNAPSHOT.txt
```

---

## 4. Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Chain integrity | `python verify_chain.py` | PASS: All N lines verified |
| No .replit.app | `grep -ri ".replit.app" .` | No matches |
| No .replit.dev | `grep -ri ".replit.dev" .` | No matches |
| No API keys exposed | `grep -ri "x-api-key:" . \| grep -v REDACTED` | No matches |
| No IP addresses | `grep -rE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" . \| grep -v REDACTED` | No matches |
| Snapshot timestamp valid | Compare timestamps | SNAPSHOT >= last event |
| Hash in snapshot | `grep $LAST_HASH SNAPSHOT.txt` | Match found |

---

## Trust Model

This verification proves:

1. **Chain Integrity**: No events have been modified or deleted (hash chain)
2. **No IP Leakage**: No deployment URLs, API keys, or identifiable data remain
3. **Temporal Consistency**: Snapshot reflects the latest state

It does NOT prove:

- Events were logged at the claimed times (requires external timestamp witness)
- All relevant events were logged (requires coverage audit)
- The system behaves as documented (requires code audit)

For higher assurance, request access to the source code repository and run the full test suite.
