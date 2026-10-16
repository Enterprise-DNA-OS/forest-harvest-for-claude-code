---
description: "Draft the written notice of harvesting or replanting to the regional council and territorial authority."
---

# /draft-notice

Say the window it must be given in. Use the council's own form if it has one.

```bash
node scripts/harvest.mjs draft-notice "<code>" [--kind=harvest|replant]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
