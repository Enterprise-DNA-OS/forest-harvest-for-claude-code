---
description: "Bring dockets across from a PSLog docket report, or a mill statement, saved as CSV."
---

# /import

Read docs/replace-pslog.md. Add the harvests first. Always run with --dry-run first and show the counts. Dockets before mill statements.

```bash
node scripts/harvest.mjs import pslog --file=<dockets.csv> [--harvest=<code>] --dry-run
```

Use the configured database. Add `--json` when structured output helps. If a name is ambiguous, list the candidates and ask. Never guess a record and never send a message.
