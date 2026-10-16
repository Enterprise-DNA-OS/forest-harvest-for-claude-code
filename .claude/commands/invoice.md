---
description: "Invoice a buyer for every received load not yet invoiced, or record a buyer-created statement under their reference. Creates the record; nothing is sent."
---

# /invoice

For a buyer that creates the tax invoice, ask for their statement reference.

```bash
node scripts/harvest.mjs invoice "<buyer>" [--to=YYYY-MM-DD] [--ref=<their statement>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
