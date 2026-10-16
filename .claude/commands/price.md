---
description: "Set a buyer's price for a grade from a date. Loads from that date are valued at it."
---

# /price

Say how many recorded loads the new price changes.

```bash
node scripts/harvest.mjs price "<buyer>" <grade> <dollars per tonne> --from=YYYY-MM-DD
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
