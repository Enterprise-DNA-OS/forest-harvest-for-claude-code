# Moving off PSLog

PSLog keeps a record of every docket and produces reports for each party in the supply chain. Its reports can be produced in Excel (Interpine's description of PSLog in its Forest Management Cloud, checked 16 October 2026). That is the way across: export the docket detail, save it as CSV, import it here.

PSLog does not publish its column names, and every installation is set up a little differently. The import reads the common labels listed below. If yours differ, rename the header row in the spreadsheet, or ask `/customise` to add your labels to `COLUMNS` in `scripts/harvest.mjs`.

## Before you import

1. Add your owners, forests and harvests (`add owners`, `add forests`, `add operations --code=...`). Every docket must belong to a harvest, by a column in the report or with `--harvest=<code>`.
2. Add your buyers, grade codes, carriers and trucks if you want their details right. Unknown grades, buyers, carriers and trucks are created by the import and counted, so you can fill in their details after.
3. Add each buyer's price sheet with `price` and each carrier's rates with `add cartage_rates`. Loads are valued from these.

## Dockets

Export the docket detail report for the period you want, one row per load, and save it as CSV.

```bash
npm run harvest -- import pslog --file=dockets.csv --dry-run
npm run harvest -- import pslog --file=dockets.csv
npm run harvest -- import pslog --file=setting4.csv --harvest=TAW-H04   # a report for one harvest with no harvest column
```

| Here | Column labels read |
|---|---|
| Docket number | Docket No, Docket Number, Docket, Docket #, Docket No., Load Docket |
| Date loaded | Docket Date, Load Date, Date, Date Loaded, Cart Date |
| Harvest | Harvest, Operation, Setting, Block, Crop, Harvest Area |
| Grade | Product, Grade, Log Grade, Product Code, Sort |
| Buyer | Customer, Destination, Buyer, Mill, Delivered To |
| Truck | Truck, Truck Rego, Truck No, Vehicle, Rego |
| Carrier | Carrier, Transport, Cartage Contractor, Haulier, Transporter |
| Gross and tare (kg) | Gross, Gross Weight, Gross Kg; Tare, Tare Weight, Tare Kg |
| Net tonnes | Nett, Net, Net Tonnes, Nett Tonnes, Tonnes |

Dates read as YYYY-MM-DD or DD/MM/YYYY. Where gross and tare are both given, net is worked out from them; otherwise the nett tonnes column is used. The import upserts on the docket number, so you can run it again after fixing the spreadsheet.

## Mill statements

Each buyer's statement of loads received, saved as CSV, one buyer at a time:

```bash
npm run harvest -- import mill --customer="Manawatu Sawmills" --file=statement.csv --dry-run
npm run harvest -- import mill --customer="Manawatu Sawmills" --file=statement.csv
npm run harvest -- reconcile
```

| Here | Column labels read |
|---|---|
| Docket number | as above |
| Received date | Received Date, Date Received, Delivery Date, Date |
| Tonnes received | Mill Tonnes, Received Tonnes, Weighbridge Tonnes, Tonnes, Nett, Net |
| Value excluding GST | Value, Amount, Nett Value, Payment, Extended Value, Value Excl GST |
| Levy deducted | Levy, FGL Levy, Forest Growers Levy, Levy Deducted |
| Statement reference | Statement, Statement No, Statement Ref, Remittance |

A statement line with no matching docket is kept and shown by `reconcile` as NO DOCKET until the docket arrives.

## What does not come across

- Invoices, buyer-created statements, owner returns and contractor payments already issued in PSLog. Start each from the first period you run here, and record older ones with `add invoices` if you want the payment history for insight 1.
- Rate tables and price history. Enter the sheets in force, then older prices with `--from=` if you import older dockets.
- Accounting links. The invoices and pay runs here are records; connecting them to Xero or MYOB is a customisation.
- Users, permissions and audit history.

Fictional examples of both files are in `examples/pslog/`.
