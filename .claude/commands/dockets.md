---
description: "Recent loads with grade, buyer, truck, weights, mill tonnes and value. Filter by harvest, buyer or date."
---

# /dockets

Show the last 40 unless asked for more. Use --since= for a date range.

```bash
node scripts/harvest.mjs dockets [--harvest=<code>] [--customer=<buyer>] [--since=YYYY-MM-DD]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
