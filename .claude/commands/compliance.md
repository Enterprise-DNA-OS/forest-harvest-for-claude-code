---
description: "Check the records against the rules in docs/compliance.md and report each gap with its source."
---

# /compliance

Read docs/compliance.md first. Order by due date. Never say the operation complies; say what the checks found.

```bash
node scripts/harvest.mjs compliance
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
