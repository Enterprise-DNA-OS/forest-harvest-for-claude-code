# Record checks

`/compliance` (or `npm run harvest -- compliance`) checks the records against the rules below. Each rule says where it comes from, what the check looks for, and what it cannot see. The intervals and rates sit in the `settings` table, so you can change them without touching code.

This is a record check, not legal or tax advice. A clean result means the records show no gap against these rules. It does not mean the operation complies: the check only sees what was recorded. Read the source before relying on any rule, and ask `/customise` to change one when your council, adviser or the law says otherwise.

Sources were checked on 16 October 2026.

## Working days

The council notice rules count working days. The check uses the Resource Management Act 1991, section 2: a working day is any day except a Saturday, a Sunday, the public holidays listed there (including the Monday when Waitangi Day or Anzac Day falls on a weekend), and any day from 20 December to 10 January. Public holidays live in the `holidays` table; the demo loads 2026 and 2027. Add each new year as it comes: `npm run harvest -- add holidays --on_date=2028-01-03 --name="Day after New Year's Day (Monday)"`.

The check counts the working days strictly between the day notice is given and the day the activity begins. Counting that way is the cautious reading: if your council counts differently, change `working_days_between` in a new migration through `/customise`.

## HARVEST-NOTICE

- **Source:** Resource Management (National Environmental Standards for Commercial Forestry) Regulations 2017, regulation 64 ([legislation.govt.nz](https://www.legislation.govt.nz/secondary-legislation/pco-drafted/2017/174/en/latest/)).
- **The rule:** the regional council and territorial authority must be given written notice of the place where harvesting will be carried out and the dates it is planned to begin and end, at least 20 and no more than 60 working days before it begins. Salvage harvesting needs at least 2 days. Ongoing harvesting can be notified annually.
- **What the check flags:** a planned or active harvest with no notice recorded once its last day for notice is within 14 days; a notice given after that day; a notice given before the window opens.
- **Settings:** `notice_min_working_days` (20), `notice_max_working_days` (60), `salvage_notice_days` (2).
- **What it cannot see:** whether the notice reached both councils, whether it gave the place and both dates, or an annual notice for ongoing harvesting. Record the date of the later of the two notices.

## HARVEST-PLAN

- **Source:** NES-CF regulation 66(2)(c) and (d).
- **The rule:** a harvesting plan is required in every erosion susceptibility zone, and must be in place at least 20 working days before harvesting begins, or before it begins for a salvage operation. The council may ask for a copy (regulation 64(3)).
- **What the check flags:** no plan date recorded once the plan's deadline is within 14 days, or a plan completed after it.
- **Settings:** `plan_min_working_days` (20).
- **What it cannot see:** the plan's content (Schedule 6), or the forestry earthworks management plan regulation 66(3) adds in orange and red zones.

## REPLANT-NOTICE

- **Source:** NES-CF regulation 78A.
- **The rule:** written notice of the location, the proposed setbacks and how they were calculated, and the planned dates, given to the regional council and territorial authority at least 20 working days and no more than 8 months before replanting begins.
- **What the check flags:** a planned replanting with no notice recorded once its last day is within 30 days, a notice given after that day, or more than 8 months ahead.
- **Settings:** `replant_notice_min_working_days` (20), `replant_notice_max_months` (8).
- **What it cannot see:** the wilding tree risk score (regulation 79) and the replanting management plan (77A).

## BCTI-AGREEMENT

- **Source:** Inland Revenue, [Buyer-created taxable supply information](https://www.ird.govt.nz/gst/tax-invoices-for-gst/buyer-created-taxable-supply-information); Goods and Services Tax Act 1985, sections 19K to 19N.
- **The rule:** since 1 April 2023 a GST-registered buyer can create the taxable supply information for a GST-registered seller without Inland Revenue's approval, where both agree only the buyer will provide it, record the reasons when it is not their normal terms of business, and both keep a copy. Inland Revenue can invalidate an agreement that is not complied with.
- **What the check flags:** a buyer marked as creating your sales invoices with no agreement date recorded; a contractor tax invoice you created with no agreement on file, or one dated after the invoice.
- **What it cannot see:** the agreement itself. Keep it on file and record its date.

## BCTI-GST-NUMBERS

- **Source:** the same Inland Revenue page: buyer-created information must show the buyer's and the seller's GST numbers, with GST added to the gross supply.
- **What the check flags:** a contractor you create invoices for with no GST number; your own GST number missing from settings while you create invoices; an owner whose loads go to a buyer that creates the invoice, with no GST number recorded.
- **What it cannot see:** whether a GST number is valid or current.

## LEVY-UNACCOUNTED

- **Source:** Commodity Levies (Harvested Wood Material) Order 2025 (SL 2025/198), made under the Commodity Levies Act 1990. The levy for the first levy year (18 November 2025 to 31 December 2026) is 33 cents a tonne of harvested wood material, excluding GST; the Order caps it at 45 cents. Forest owners are primarily responsible for it, and a buyer who pays it may recover it by deducting it from the payment for the logs.
- **What the check flags:** a finished month where some tonnes had no levy deducted by the buyer and no owner payment is recorded.
- **Settings:** `levy_cents_per_tonne` (33). Change it when the Forest Growers Levy Trust sets a new rate.
- **What it cannot see:** the levy collector's own invoices and due dates. Record the payment with `levy-paid`.

## OVERWEIGHT-LOAD

- **Source:** Land Transport Rule: Vehicle Dimensions and Mass 2016; NZ Transport Agency, [high productivity motor vehicles](https://nzta.govt.nz/commercial-driving/high-productivity) and 50MAX permits.
- **The rule:** a vehicle may run at the mass its class and any permit allow. 44,000 kg is the long-standing general limit; 7 and 8 axle combinations can run at 45,000 and 46,000 kg when long enough, and 50MAX or HPMV permits allow more on approved routes.
- **What the check flags:** a docket whose gross weight is above the truck's recorded maximum, or above `default_max_gross_kg` (44,000) for a truck with none recorded.
- **What it cannot see:** axle loads, route restrictions or the permit itself. Record each truck's `max_gross_kg` from its permit or class.

## Not checked here

- Log trader and forestry adviser registration was repealed on 29 June 2024 (Forests (Log Traders and Forestry Advisers Repeal) Amendment Act 2024), so this version has no registration check.
- Emissions Trading Scheme returns, deforestation and carbon units. Ask for them as a customisation if your forests are registered.
- Health and safety in forest operations (the Health and Safety at Work Act 2015 and its approved code of practice). The crew's own system holds those records.
