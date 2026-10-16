---
description: "Mark a harvest started. Loads can only be recorded against an active harvest."
---

# /start

Check the notice and harvesting plan first and say if either is missing.

```bash
node scripts/harvest.mjs start "<code>" --on=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
