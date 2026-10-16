# Why there is no front end

Under a harvest and log sales system sits an ordinary set of records: forests and their owners, harvests with a crew and a rate, one docket per load, a price sheet per buyer, what each mill says it received, and the money owed in three directions. What you pay a vendor for is the layer on top that lets the office get at those records without writing queries.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "which dockets has the mill not reported?" or "what did Te Awa net per tonne last month?", and it runs the query and explains the answer. Ask a question the report menu never had and you still get an answer.

## What you gain

- **Better answers.** Which buyer pays best for each grade, which crew moves the most tonnes a day, what cartage costs against what the load earns. Your own question, against your own records.
- **No seats.** Harvest managers, accounts and owners' advisers can all look. The bill does not grow with headcount.
- **Your records in your Postgres.** Plain tables. Back them up, query them from anything, leave any time.
- **Your rates and rules, not the vendor's.** Your grade codes, your management fee, your tolerance on mill tonnes. Change a setting or ask `/customise`.

## What you give up

- **Electronic dockets in the cab.** Drivers do not tap a screen here. Dockets come in from the weighbridge, a docket book or a CSV, or Enterprise DNA connects your docket app.
- **A screen to key dockets into all day.** Loads go in by command, by import, or from a connected feed.
- **Maps.** Stands and settings are records, not polygons. Your GIS stays where it is.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for businesses that want someone to call.

## Who this fits

Forest managers, harvest contractors and woodlot owners' agents who already pull dockets and mill statements together at month end and want that work done by a query. If your crews depend on in-cab docketing every day, keep that tool and move the money, reconciliation and owner returns here.

Installed and run for you: https://enterprisedna.co/omni/instead-of/pslog
