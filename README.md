<h1 align="center">Forest Harvest for Claude Code</h1>

<p align="center">
  <strong>The open-source log docket and harvest money system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your PSLog data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=pslog">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/pslog?utm_source=github&utm_medium=readme&utm_campaign=pslog">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-pslog">Instead of PSLog</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Forest Harvest for Claude Code does the job you pay PSLog for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the PSLog dashboard cannot.

PSLog does not publish a price: its site (pslog.co.nz, checked 16 October 2026) offers a contact form, not a price list, and Interpine sells it hosted in its Forest Management Cloud. The NZ alternatives, Logrithm and Trimble's Connected Forest, quote privately too. Here there is no licence fee: the database is yours.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=pslog).

It covers the money and paperwork side of harvesting a forest: owners and their forests, each harvest with its crew, contract rate and council notices, one docket per load, each buyer's price sheet, what the mill or exporter says it received, sales invoices and buyer-created statements, the owner's monthly return, pay runs for logging crews and carriers, and the growers' levy. It is for the harvest manager and accounts at a New Zealand forest management business, harvest contractor or woodlot owners' agent running a handful of harvests at a time.

What it is not: an in-cab docket app, a GIS or a forest inventory. Drivers' electronic dockets, maps and stand growth models stay where they are; see [docs/why-no-front-end.md](docs/why-no-front-end.md).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No licence quote, no seats. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/forest-harvest-for-claude-code.git
cd forest-harvest-for-claude-code
npm install
npm run demo
```

`npm run demo` loads a fictional forest manager with three owners, three buyers and four harvests into `.data/demo` and prints what needs attention, the harvests and the record checks. Then open the folder in Claude Code and type `/attention`, or ask "which dockets has the mill not reported?".

```bash
npm test                                   # 130+ checks on a throwaway database
DATA_DIR=.data/demo npm run harvest -- harvest TAW-H03
DATA_DIR=.data/demo npm run harvest -- insights 2
DATA_DIR=.data/demo npm run view           # views/week.html, money.html, mill.html, compliance.html
DATA_DIR=.data/demo npm run docs           # docs-out/: owner returns, invoices, buyer-created invoices, harvest notices, levy summaries
```

For real records, use a fresh database and run `npm run migrate` without seeding. Add your owners, forests, harvests, buyers and price sheets, then import your PSLog dockets.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/harvests` | Every harvest: forest, owner, crew, status, tonnes against the estimate, pace and what it is returning the owner per tonne. |
| `/harvest` | One harvest in full: tonnes and pace, grade mix by buyer, the last 7 days, council notices, record checks and notes. |
| `/dockets` | Recent loads with grade, buyer, truck, weights, mill tonnes and value. Filter by harvest, buyer or date. |
| `/docket` | One load in full: weights, mill tonnes, price, every cost and what the owner nets from it. |
| `/load` | Record a docket as the load leaves the skid. Values it from the price sheet and flags an overweight truck or a missing price. |
| `/mill` | Record one line off a mill or exporter statement: what they received, what they will pay, any levy they took. |
| `/reconcile` | Mill statements against dockets: loads the mill has not reported, statement lines with no docket, tonnes or values that differ, loads with no price. |
| `/prices` | The price sheet in force: what each buyer pays per tonne for each grade, and since when. |
| `/price` | Set a buyer's price for a grade from a date. Loads from that date are valued at it. |
| `/notices` | Council notices for every planned harvest and replanting: the window, the last day, what was given, and the harvesting plan. |
| `/notice` | Record a notice of harvesting or replanting, or the harvesting plan, as given or in place on a date. |
| `/start` | Mark a harvest started. Loads can only be recorded against an active harvest. |
| `/finish` | Mark a harvest finished and prompt for the replanting date. |
| `/receivables` | Money owed by buyers: received loads not invoiced, and invoices or statements not yet paid. |
| `/invoice` | Invoice a buyer for every received load not yet invoiced, or record a buyer-created statement under their reference. Creates the record; nothing is sent. |
| `/paid` | Record that an invoice, owner return or contractor pay was paid. |
| `/owner-return` | Write the owner's return for a month: every received load, sale, logging, cartage, levy, your fee and the net. |
| `/contractor-pay` | Pay a logging crew or carrier for every unpaid load. With an agreement on file it is a buyer-created tax invoice. |
| `/levy` | The growers' levy by owner and month: due, deducted by buyers, left for the owner to pay, and paid. |
| `/levy-paid` | Record the owner's levy payment for a month. |
| `/owner` | One owner in full: harvests, loads not yet on a return, returns, levy and notes. |
| `/attention` | Everything that needs someone: council notices, overweight trucks, mill differences, money not invoiced or overdue, owner returns and contractor pay due. |
| `/compliance` | Check the records against the rules in docs/compliance.md and report each gap with its source. |
| `/insights` | Answer one or all of the ten questions across the records. |
| `/add` | Add a record: owner, forest, harvest, contractor, buyer, grade, truck, cartage rate or holiday. |
| `/update` | Change fields on an existing record. |
| `/log` | Record a note against a harvest (and its owner). |
| `/weekly-review` | Write the Monday harvest review from attention, harvests and record checks. |
| `/draft-owner-update` | Draft an update to a forest owner: tonnes, what each harvest has returned per tonne, and what is coming on the next return. |
| `/draft-notice` | Draft the written notice of harvesting or replanting to the regional council and territorial authority. |
| `/draft-chaser` | Draft a payment follow-up to a buyer for an unpaid invoice or statement. |
| `/import` | Bring dockets across from a PSLog docket report, or a mill statement, saved as CSV. |
| `/export` | Export the whole database to a JSON backup. |
| `/documents` | Render owner returns, tax invoices, buyer-created contractor invoices, harvest notices and levy summaries as branded HTML. |
| `/view` | Render the read-only dashboards: the week, money, the mill and record checks. |
| `/customise` | Change a field, grade, rate or rule in plain language: migration, test and docs together. |
| `/new-view` | Add a read-only dashboard page from a plain-language description. |

The full CLI reference is [docs/cli.md](docs/cli.md). Every read takes `--json`, `--harvest=`, `--customer=` and `--owner=`. Names match without case, fragments work, and an ambiguous name lists the candidates and exits 1. Drafts go to `drafts/` and are never sent.

## Ten questions to ask across your own records

These run today with `npm run harvest -- insights`:

1. Which buyers pay us slowest, against their own payment terms?
2. What did each harvest return to the owner per tonne, after logging, cartage, levy and fees?
3. What is each harvest's grade mix, and what does each grade earn per tonne?
4. Which buyer paid best for each grade in the last 90 days?
5. Which dockets are missing from mill statements, and what are they worth?
6. Where do mill tonnes differ from our docket tonnes, by buyer?
7. What does cartage cost per tonne to each buyer, against what the load earns there?
8. Which crews produce the most tonnes per working day?
9. Which trucks run heavy or light against what they may carry?
10. How many tonnes are left on each harvest, and when does it finish at the current pace?

## Record checks

`/compliance` checks the records against these rules. Each rule, its source and its limits are in [docs/compliance.md](docs/compliance.md). The intervals and rates are settings.

| Rule | What it flags |
|---|---|
| `HARVEST-NOTICE` | Written notice of harvesting not given 20 to 60 working days before the start (NES-CF reg 64) |
| `HARVEST-PLAN` | No harvesting plan in place 20 working days before harvesting begins (NES-CF reg 66) |
| `REPLANT-NOTICE` | Replanting notice not given 20 working days to 8 months before replanting (NES-CF reg 78A) |
| `BCTI-AGREEMENT` | Buyer-created tax invoices with no agreement on file, either direction (Inland Revenue) |
| `BCTI-GST-NUMBERS` | Buyer-created invoices where a GST number is missing (Inland Revenue) |
| `LEVY-UNACCOUNTED` | Harvested tonnes in a finished month with no growers' levy deducted or paid (Commodity Levies (Harvested Wood Material) Order 2025) |
| `OVERWEIGHT-LOAD` | A docket heavier than the truck may carry (Vehicle Dimensions and Mass Rule 2016) |

Working days follow the Resource Management Act: no weekends, public holidays or 20 December to 10 January.

## Documents and views

`npm run docs` renders, in your brand from `brand.json`: each owner's harvest return, tax invoices to buyers, buyer-created tax invoices for contractors, notices of harvesting for the council, and a levy summary per owner. `npm run view` renders four read-only dashboards: the week, the money, the mill against your dockets, and record checks. Print them or open them in a browser.

## Your first hour: ten things to ask for

1. "Our business is Kahikatea Forest Management, GST 123-456-780, and we charge owners $4 a tonne."
2. "Add the Te Awa Whanau Trust and their forest, Horizons and Tararua District councils."
3. "Add harvest TAW-H03, Ridgeline Logging at $32 a tonne, starting on the first."
4. "Pacific Log Exports pays $138 for A grade from today, and they create our invoices."
5. "Import last month's PSLog docket report." (dry run first)
6. "Import Manawatu Sawmills' statement and tell me what does not match."
7. "What needs someone today?"
8. "Write Te Awa's return for September and draft the note to Hemi."
9. "When is the last day to give notice for the McKenzie harvest? Draft it."
10. "Our grades are A, K, KI, KS, P1, S1 to S3, L1 to L3 and pulp, and add a log scaler to each docket." (that is `/customise`)

## Instead of PSLog

PSLog records every docket, prices and costs each load, reconciles docket data from different sources, and produces tax and buyer-created invoices (pslog.co.nz, checked 16 October 2026). Its reports can be produced in Excel. Export the docket detail for the period, save it as CSV, and import it:

```bash
npm run harvest -- import pslog --file=dockets.csv --dry-run
npm run harvest -- import pslog --file=dockets.csv
npm run harvest -- import mill --customer="Manawatu Sawmills" --file=statement.csv
```

Add the harvests first: every docket belongs to one, from a harvest or setting column or `--harvest=<code>`. Unknown grades, buyers, carriers and trucks are created and counted. The import upserts on the docket number, so you can run it again. Invoices, owner returns and pay runs already issued in PSLog do not come across in this version. Read [docs/replace-pslog.md](docs/replace-pslog.md) for the column names and what maps where. Fictional examples are in `examples/pslog/`.

## Architecture

```
forest-harvest-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/harvest.mjs       the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema, the rule checks and the working-day functions
  supabase/seed.sql         demo data: one fictional forest manager, a late notice, missing dockets, an overweight truck, unpaid money
  views.json                read-only dashboards (npm run view)
  documents.json            owner returns, invoices, buyer-created invoices, notices, levy (npm run docs)
  examples/pslog/           fictional docket report and mill statement for the import
  docs/                     the rules, the CLI reference and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Forest Harvest for Claude Code for your business, migrates your PSLog data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=pslog)
- Read more: [enterprisedna.co/omni/instead-of/pslog](https://enterprisedna.co/omni/instead-of/pslog?utm_source=github&utm_medium=readme&utm_campaign=pslog)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
