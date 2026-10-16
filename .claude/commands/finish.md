---
description: "Mark a harvest finished and prompt for the replanting date."
---

# /finish

Ask for the replanting date and notice next.

```bash
node scripts/harvest.mjs finish "<code>" --on=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
