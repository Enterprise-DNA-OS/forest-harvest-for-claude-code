---
description: "Draft an update to a forest owner: tonnes, what each harvest has returned per tonne, and what is coming on the next return."
---

# /draft-owner-update

Read /owner first. Check the figures against the latest mill statements.

```bash
node scripts/harvest.mjs draft-owner-update "<owner>"
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
