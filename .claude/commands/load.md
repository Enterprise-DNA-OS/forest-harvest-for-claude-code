---
description: "Record a docket as the load leaves the skid. Values it from the price sheet and flags an overweight truck or a missing price."
---

# /load

Confirm the harvest, grade, buyer and truck back in one line. Say any warning plainly.

```bash
node scripts/harvest.mjs load "<docket>" --harvest=<code> --product=<grade> --customer="<buyer>" --truck=<rego> --gross=<kg> --tare=<kg>
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
