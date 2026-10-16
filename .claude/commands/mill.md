---
description: "Record one line off a mill or exporter statement: what they received, what they will pay, any levy they took."
---

# /mill

For a whole statement use /import. Show any difference the line trips.

```bash
node scripts/harvest.mjs mill "<buyer>" "<docket>" --tonnes=<t> --value=<dollars> [--levy=<dollars>] [--ref=<statement>]
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
