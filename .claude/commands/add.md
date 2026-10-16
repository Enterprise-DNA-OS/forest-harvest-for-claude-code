---
description: "Add a record: owner, forest, harvest, contractor, buyer, grade, truck, cartage rate or holiday."
---

# /add

Read back what was added. Reference fields take names.

```bash
node scripts/harvest.mjs add <kind> --field=value
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
