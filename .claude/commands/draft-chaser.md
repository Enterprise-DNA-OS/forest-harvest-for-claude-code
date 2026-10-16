---
description: "Draft a payment follow-up to a buyer for an unpaid invoice or statement."
---

# /draft-chaser

Read the invoice first. Never send.

```bash
node scripts/harvest.mjs draft-chaser "<invoice>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
