---
description: "Record a notice of harvesting or replanting, or the harvesting plan, as given or in place on a date."
---

# /notice

Show the window after recording and any finding still open.

```bash
node scripts/harvest.mjs notice "<code>" --kind=harvest|plan|replant --on=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
