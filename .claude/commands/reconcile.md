---
description: "Mill statements against dockets: loads the mill has not reported, statement lines with no docket, tonnes or values that differ, loads with no price."
---

# /reconcile

Group by buyer. For each difference say what to ask the mill, and offer a draft.

```bash
node scripts/harvest.mjs reconcile
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
