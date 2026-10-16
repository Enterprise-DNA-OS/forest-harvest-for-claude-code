---
description: "Pay a logging crew or carrier for every unpaid load. With an agreement on file it is a buyer-created tax invoice."
---

# /contractor-pay

Say whether it is buyer-created, and any GST number missing.

```bash
node scripts/harvest.mjs contractor-pay "<contractor>" --to=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
