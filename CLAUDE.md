# Forest Harvest for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS] (a forest manager, harvest contractor or woodlot owners' agent)
- **Operator:** [YOUR NAME], [harvest manager, accounts, or the owner's adviser]
- **What matters most:** [for example: no council notice late, every docket on a mill statement, owners paid on time]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a harvest, owner or buyer, read its full record first.
3. **Plain language.** Short sentences. No filler. Numbers in tables. Tonnes to one decimal place in prose.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces an owner, buyer, contractor or council waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Every harvest: forest, owner, crew, status, tonnes against the estimate, pace and what it is returning the owner per tonne. | `/harvests` |
| One harvest in full: tonnes and pace, grade mix by buyer, the last 7 days, council notices, record checks and notes. | `/harvest` |
| Recent loads with grade, buyer, truck, weights, mill tonnes and value. Filter by harvest, buyer or date. | `/dockets` |
| One load in full: weights, mill tonnes, price, every cost and what the owner nets from it. | `/docket` |
| Record a docket as the load leaves the skid. Values it from the price sheet and flags an overweight truck or a missing price. | `/load` |
| Record one line off a mill or exporter statement: what they received, what they will pay, any levy they took. | `/mill` |
| Mill statements against dockets: loads the mill has not reported, statement lines with no docket, tonnes or values that differ, loads with no price. | `/reconcile` |
| The price sheet in force: what each buyer pays per tonne for each grade, and since when. | `/prices` |
| Set a buyer's price for a grade from a date. Loads from that date are valued at it. | `/price` |
| Council notices for every planned harvest and replanting: the window, the last day, what was given, and the harvesting plan. | `/notices` |
| Record a notice of harvesting or replanting, or the harvesting plan, as given or in place on a date. | `/notice` |
| Mark a harvest started. Loads can only be recorded against an active harvest. | `/start` |
| Mark a harvest finished and prompt for the replanting date. | `/finish` |
| Money owed by buyers: received loads not invoiced, and invoices or statements not yet paid. | `/receivables` |
| Invoice a buyer for every received load not yet invoiced, or record a buyer-created statement under their reference. Creates the record; nothing is sent. | `/invoice` |
| Record that an invoice, owner return or contractor pay was paid. | `/paid` |
| Write the owner's return for a month: every received load, sale, logging, cartage, levy, your fee and the net. | `/owner-return` |
| Pay a logging crew or carrier for every unpaid load. With an agreement on file it is a buyer-created tax invoice. | `/contractor-pay` |
| The growers' levy by owner and month: due, deducted by buyers, left for the owner to pay, and paid. | `/levy` |
| Record the owner's levy payment for a month. | `/levy-paid` |
| One owner in full: harvests, loads not yet on a return, returns, levy and notes. | `/owner` |
| Everything that needs someone: council notices, overweight trucks, mill differences, money not invoiced or overdue, owner returns and contractor pay due. | `/attention` |
| Check the records against the rules in docs/compliance.md and report each gap with its source. | `/compliance` |
| Answer one or all of the ten questions across the records. | `/insights` |
| Add a record: owner, forest, harvest, contractor, buyer, grade, truck, cartage rate or holiday. | `/add` |
| Change fields on an existing record. | `/update` |
| Record a note against a harvest (and its owner). | `/log` |
| Write the Monday harvest review from attention, harvests and record checks. | `/weekly-review` |
| Draft an update to a forest owner: tonnes, what each harvest has returned per tonne, and what is coming on the next return. | `/draft-owner-update` |
| Draft the written notice of harvesting or replanting to the regional council and territorial authority. | `/draft-notice` |
| Draft a payment follow-up to a buyer for an unpaid invoice or statement. | `/draft-chaser` |
| Bring dockets across from a PSLog docket report, or a mill statement, saved as CSV. | `/import` |
| Export the whole database to a JSON backup. | `/export` |
| Render owner returns, tax invoices, buyer-created contractor invoices, harvest notices and levy summaries as branded HTML. | `/documents` |
| Render the read-only dashboards: the week, money, the mill and record checks. | `/view` |
| Change a field, grade, rate or rule in plain language: migration, test and docs together. | `/customise` |
| Add a read-only dashboard page from a plain-language description. | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run harvest -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends. Council notices, owner updates and payment chasers are drafts.
- Never delete records without an explicit yes in this session. Prefer marking a harvest cancelled or finished.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- A late council notice or harvesting plan leads every answer about that harvest until it is recorded.
- Never record a notice, a payment, a mill line or a load the operator did not state. A recorded date is evidence, not an approval.
- Mill statements win on tonnes and value once they arrive. Never change a mill line to match a docket; raise the difference with the buyer.
- Read `docs/compliance.md` before explaining a finding. Never say an operation complies; say what the checks found.
- Money: `--rate`, `--fee`, `--value`, `--levy`, `--amount` and prices are dollars. Fields ending `_cents` are cents. Weights are kg, tonnes are t.
- Schema change: back up with `export`, write a new numbered migration, run `npm run migrate` and `npm test`.
- Plain words, no em dashes.

## Where things live

- `scripts/harvest.mjs` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it. The rule checks are the `v_compliance` view; attention is `v_attention`.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `views.json` and `documents.json` the dashboards and paperwork, in the brand from `brand.json`.
- `docs/` the rules with their sources, the CLI reference, and the guide for moving off PSLog.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/pslog
