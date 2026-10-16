---
description: "Export the whole database to a JSON backup."
---

# /export

Say where the file is.

```bash
node scripts/harvest.mjs export --out=backup-YYYY-MM-DD.json
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
