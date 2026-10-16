# Example exports (fictional)

`dockets.csv` is shaped like a PSLog docket report saved from Excel as CSV: one row per load. `mill-statement.csv` is shaped like a sawmill's weekly statement of loads received. Every name and number here is invented.

```bash
npm run harvest -- add operations --code=PSL-DEMO --forest_id="Te Awa Forest" --status=active
npm run harvest -- import pslog --file=examples/pslog/dockets.csv --dry-run
npm run harvest -- import pslog --file=examples/pslog/dockets.csv
npm run harvest -- import mill --customer="Manawatu Sawmills" --file=examples/pslog/mill-statement.csv
npm run harvest -- reconcile
```

The import reads common column labels. If yours differ, see `docs/replace-pslog.md`.
