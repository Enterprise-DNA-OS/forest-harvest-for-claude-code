---
description: "Write the Monday harvest review from attention, harvests and record checks."
---

# /weekly-review

The CLI saves a review in drafts/. Read it and give the forest manager their three priorities for the week.

```bash
node scripts/harvest.mjs weekly-review
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
