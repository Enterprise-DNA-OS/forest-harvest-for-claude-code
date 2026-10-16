---
description: "Record the owner's levy payment for a month."
---

# /levy-paid

Show the tonnes and amount recorded.

```bash
node scripts/harvest.mjs levy-paid "<owner>" --month=YYYY-MM --on=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
