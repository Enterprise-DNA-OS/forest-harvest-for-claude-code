# CLI reference

`npm run harvest -- <command>` (or `node scripts/harvest.mjs <command>`). Every command prints a table; add `--json` for structured output. Names match without case, fragments work, and an ambiguous name lists the candidates and exits 1.

## Reads

| Command | What it shows |
|---|---|
| `harvests` | Every harvest: tonnes against estimate, pace, owner net per tonne |
| `harvest <code>` | One harvest: grade mix, last 7 days, notices, findings, notes |
| `dockets [--since=date] [--all]` | Recent loads (40 by default) |
| `docket <number>` | One load and every cost against it |
| `owner <name>` | One owner: harvests, months not returned, returns, levy |
| `owners`, `forests`, `customers`, `contractors`, `trucks`, `products` | The lists |
| `prices` | The price sheet in force |
| `notices` | Council notice windows and what was given |
| `reconcile` | Mill statements against dockets |
| `receivables`, `invoices`, `returns`, `pays`, `levy` | Money in every direction |
| `attention` | Everything that needs someone |
| `compliance` | Record checks against docs/compliance.md |
| `insights [1..10]` | The ten questions |

Reads take `--harvest=`, `--customer=` and `--owner=` filters.

## Writes

| Command | What it does |
|---|---|
| `load <docket> --harvest= --product= --customer= --truck= --gross=kg --tare=kg [--net=t] [--on=date]` | Record a load |
| `mill <buyer> <docket> --tonnes= [--value=$] [--levy=$] [--on=date] [--ref=]` | Record a mill statement line |
| `price <buyer> <grade> <$ per t> [--from=date]` | Set a price |
| `notice <code> --kind=harvest\|plan\|replant [--on=date]` | Record a notice or the harvesting plan |
| `start <code>`, `finish <code>` | Harvest status |
| `invoice <buyer> [--to=date] [--ref=]` | Invoice received loads, or record a buyer-created statement |
| `paid <number> [--on=date]` | An invoice, owner return or contractor pay was paid |
| `owner-return <owner> --month=YYYY-MM` | The owner's return for a month |
| `contractor-pay <contractor> [--to=date]` | Pay run for a crew or carrier |
| `levy-paid <owner> --month=YYYY-MM` | The owner paid the levy |
| `add <kind> --field=value`, `update <kind> <name> --field=value` | Any record. `--rate`, `--fee` and `--amount` are dollars |
| `log <code> <note>` | A note |
| `import pslog --file= [--harvest=] [--dry-run]`, `import mill --customer= --file= [--dry-run]` | Bring records across |
| `export --out=file.json` | Backup |

## Drafts (to drafts/, never sent)

`weekly-review`, `draft-owner-update <owner>`, `draft-notice <code> [--kind=harvest|replant]`, `draft-chaser <invoice>`.

## Documents and views

`npm run docs [-- <document> [id-prefix]]` writes owner returns, tax invoices, buyer-created contractor invoices, harvest notices and levy summaries to `docs-out/`. `npm run view [-- <view>]` writes the week, money, mill and record-check dashboards to `views/`.
