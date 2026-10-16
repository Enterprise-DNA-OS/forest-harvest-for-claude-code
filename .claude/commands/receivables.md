---
description: "Money owed by buyers: received loads not invoiced, and invoices or statements not yet paid."
---

# /receivables

Overdue first, then the oldest uninvoiced.

```bash
node scripts/harvest.mjs receivables
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
