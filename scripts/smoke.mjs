// npm test: a temporary embedded database (or an isolated schema on TEST_DATABASE_URL),
// migrate, seed twice, then every command, rule boundary, import, draft, document and view.
// Never touches your data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { execute, human } from './harvest.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-harvest-smoke-'));
const postgresUrl = process.env.TEST_DATABASE_URL || '';
let control, schema;
if (postgresUrl) {
  const { default: pg } = await import('pg');
  control = new pg.Client({ connectionString: postgresUrl }); await control.connect();
  schema = 'harvest_test_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8);
  await control.query(`create schema ${schema}`);
  process.env.PGOPTIONS = `-c search_path=${schema},public`;
}
process.env.DATABASE_URL = postgresUrl; process.env.DATA_DIR = path.join(temp, 'db'); process.env.OUTPUT_DIR = temp;
const db = await getDb();
let checks = 0;
const run = (...args) => execute(db, args);
const ok = (condition, message) => { assert.ok(condition, message); console.log(`ok ${++checks}: ${message}`); };
const fail = async (args, pattern) => { await assert.rejects(() => run(...args), pattern); ok(true, `Rejects: ${args.slice(0, 3).join(' ')} (${pattern.source})`); };
const count = async (t, where = 'true') => Number((await db.query(`select count(*) as n from ${t} where ${where}`))[0].n);
const findings = async (rule) => (await run('compliance')).filter((x) => x.rule === rule);
const attention = async (item) => (await run('attention')).filter((x) => x.item === item);
const one = async (sql, params = []) => (await db.query(sql, params))[0];
const day = (n) => new Date(Date.now() + n * 86400e3).toISOString().slice(0, 10);

try {
  ok((await migrate(db)).ran.length === 1, 'Migration applies');
  ok((await migrate(db)).ran.length === 0, 'Migration is idempotent');
  await seed(db);
  const before = { dockets: await count('dockets'), mill: await count('mill_lines'), levy: await count('levy_payments') };
  await seed(db);
  ok(before.dockets > 100 && (await count('dockets')) === before.dockets && (await count('mill_lines')) === before.mill && (await count('levy_payments')) === before.levy, 'Seed is idempotent');

  // Every read
  for (const c of ['help', 'harvests', 'owners', 'forests', 'customers', 'contractors', 'trucks', 'products', 'prices', 'dockets', 'notices', 'reconcile', 'receivables', 'invoices', 'returns', 'pays', 'levy', 'compliance', 'attention'])
    ok(Boolean(await run(c)), `Read ${c}`);
  ok((await run('dockets', '--harvest=rng')).every((r) => r.harvest === 'RNG-H01'), 'Harvest filter on reads');
  ok((await run('receivables', '--customer=manawatu')).every((r) => r.customer === 'Manawatu Sawmills'), 'Customer filter on reads');
  const taw = await run('harvest', 'TAW-H03');
  ok(taw.harvest.status === 'active' && taw.grade_mix.length >= 5 && Number(taw.harvest.tonnes) > 0, 'Harvest detail: status, grade mix, tonnes');
  const d17 = await run('docket', 'TA0017');
  ok(Number(d17.sale) - Number(d17.logging) - Number(d17.cartage) - Number(d17.levy) - Number(d17.mgmt_fee) - Number(d17.owner_net) < 0.02, 'Docket detail: owner net is sale less every cost');
  ok((await run('owner', 'te awa')).not_yet_on_a_return.length > 0, 'Owner detail shows months not yet returned');

  // Name matching
  ok((await run('show', 'customers', 'PACIFIC')).name === 'Pacific Log Exports', 'Case-insensitive name match');
  ok((await run('show', 'contractors', 'ridge')).name === 'Ridgeline Logging', 'Name fragment match');
  await fail(['show', 'operations', 'TAW'], /Ambiguous operations/);
  await fail(['show', 'customers', 'nothing-like-this'], /No customers match/);

  // Attention: one of each kind in the seed
  for (const item of ['NOTICE DUE', 'PLAN DUE', 'OVERWEIGHT', 'MILL NO MILL LINE', 'MILL NO DOCKET', 'MILL TONNES DIFFER', 'MILL PRICE DIFFERS', 'NOT INVOICED', 'STATEMENT DUE',
    'INVOICE OVERDUE', 'OWNER RETURN DUE', 'CONTRACTOR PAY DUE'])
    ok((await attention(item)).length > 0, `Attention finds ${item}`);
  ok(/^(NOTICE|PLAN) DUE$/.test((await run('attention'))[0].item), 'Council notices lead the attention list');

  // Every rule has seeded evidence, a source and a doc entry
  const rules = ['HARVEST-NOTICE', 'HARVEST-PLAN', 'REPLANT-NOTICE', 'BCTI-AGREEMENT', 'BCTI-GST-NUMBERS', 'LEVY-UNACCOUNTED', 'OVERWEIGHT-LOAD'];
  const all = await run('compliance');
  ok(rules.every((r) => all.some((x) => x.rule === r)), 'Every compliance rule has seeded evidence');
  ok(all.every((x) => x.source), 'Every finding carries its source');
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'compliance.md'), 'utf8');
  ok(rules.every((r) => doc.includes(`## ${r}`)), 'Every rule is documented in docs/compliance.md');

  // Working days: weekends, listed holidays and 20 December to 10 January do not count
  ok(Number((await one(`select working_days_between('2026-10-09','2026-10-19') as n`)).n) === 5, 'Working days skip the weekend between two Fridays and Mondays');
  ok(Number((await one(`select working_days_between('2026-10-23','2026-10-28') as n`)).n) === 1, 'Labour Day is not a working day');
  ok(Number((await one(`select working_days_between('2026-12-18','2027-01-12') as n`)).n) === 1, '20 December to 10 January is not working days; 11 January is');
  const by = (await one(`select notice_by('2026-11-30', 20) as d`)).d;
  ok(Number((await one(`select working_days_between($1::date,'2026-11-30') as n`, [by])).n) === 20 && Number((await one(`select working_days_between($1::date + 1,'2026-11-30') as n`, [by])).n) < 20, 'notice_by is the last day that leaves 20 working days');

  // Harvest notice: 20 working days is in, 19 is late; more than 60 is too early; recording it clears the finding
  await run('update', 'operations', 'MCK-H01', `--planned_start=${day(40)}`);
  const give = (await one(`select give_by,window_opens from v_notices where harvest='MCK-H01' and kind='harvest'`));
  await run('notice', 'MCK-H01', '--kind=harvest', `--on=${give.give_by}`);
  ok(!(await findings('HARVEST-NOTICE')).some((x) => x.harvest === 'MCK-H01'), 'Notice on the last allowed day is in time');
  await db.query(`update operations set notice_given_on=$1::date+1 where code='MCK-H01'`, [give.give_by]);
  ok((await findings('HARVEST-NOTICE')).some((x) => x.harvest === 'MCK-H01' && /after/.test(x.finding)), 'Notice a day later is late');
  await db.query(`update operations set notice_given_on=$1::date-1 where code='MCK-H01'`, [give.window_opens]);
  ok((await findings('HARVEST-NOTICE')).some((x) => x.harvest === 'MCK-H01' && /more than the maximum/.test(x.finding)), 'Notice before the window opens is too early');
  await run('notice', 'MCK-H01', `--on=${give.window_opens}`);
  ok(!(await findings('HARVEST-NOTICE')).some((x) => x.harvest === 'MCK-H01'), 'Notice on the day the window opens counts');
  await run('notice', 'MCK-H01', '--kind=plan', `--on=${day(0)}`);
  ok(!(await findings('HARVEST-PLAN')).some((x) => x.harvest === 'MCK-H01'), 'Harvesting plan in place 40 days ahead clears the plan finding');
  await run('update', 'operations', 'MCK-H01', '--salvage=true', `--planned_start=${day(1)}`, '--notice_given_on=null');
  ok((await one(`select give_by from v_notices where harvest='MCK-H01'`)).give_by === day(-1), 'Salvage harvesting needs only 2 days notice');
  await run('update', 'operations', 'MCK-H01', '--salvage=false', `--planned_start=${day(40)}`, `--notice_given_on=${give.give_by}`);
  await fail(['notice', 'MCK-H01', '--kind=fence'], /harvest, plan or replant/);

  // Replanting notice clears
  await run('notice', 'RNG-H01', '--kind=replant', `--on=${day(-60)}`);
  ok(!(await findings('REPLANT-NOTICE')).length, 'Recording the replanting notice clears it');

  // A load: valued on entry, overweight flagged, no price warned, duplicates and nonsense refused
  await run('start', 'MCK-H01', `--on=${day(0)}`);
  const load = await run('load', 'MK0001', '--harvest=MCK-H01', '--product=A', '--customer=pacific', '--truck=HHL102', '--gross=44800', '--tare=16300');
  ok(load.load.docket_tonnes === '28.500' || Number(load.load.docket_tonnes) === 28.5, 'Load works out net tonnes from gross and tare');
  ok(Number(load.load.price_per_t) === 138 && load.warnings.some((w) => /over the 44000 kg/.test(w)), 'Load takes the price in force and flags a 44.8 t gross on a 44 t truck');
  ok((await findings('OVERWEIGHT-LOAD')).some((x) => x.record.startsWith('Docket MK0001')), 'Overweight load becomes a finding');
  const heavy = await run('load', 'MK0002', '--harvest=MCK-H01', '--product=K', '--customer=pacific', '--truck=HHL101', '--gross=50000', '--tare=16400');
  ok(!heavy.warnings.length, 'Exactly 50 t on a 50MAX truck is allowed');
  const noPrice = await run('load', 'MK0003', '--harvest=MCK-H01', '--product=P1', '--customer=pacific', '--net=27.2');
  ok(noPrice.warnings.some((w) => /No P1 price/.test(w)), 'Load with no price on the sheet is warned');
  await fail(['load', 'MK0001', '--harvest=MCK-H01', '--product=A', '--customer=pacific', '--net=20'], /already recorded/);
  await fail(['load', 'MK0009', '--harvest=TAW-H04', '--product=A', '--customer=pacific', '--net=20'], /Start it first/);
  await fail(['load', 'MK0009', '--harvest=MCK-H01', '--product=A', '--customer=pacific', '--gross=16000', '--tare=17000'], /less than gross/);
  await fail(['load', 'MK0009', '--harvest=MCK-H01', '--product=A', '--customer=pacific', '--net=20', '--on=2099-01-01'], /in the future/);
  ok((await attention('MILL NO PRICE')).some((x) => x.record === 'MK0003'), 'Load with no price shows on attention');
  const price = await run('price', 'pacific', 'P1', '160', `--from=${day(-1)}`);
  ok(price.price_per_t === 160 && !(await attention('MILL NO PRICE')).length, 'Adding the price clears it');

  // Mill lines: match a docket, a short load is flagged, the 2% boundary is inside
  const ml = await run('mill', 'pacific', 'MK0002', '--tonnes=33.6', '--value=4032', '--levy=11.09');
  ok(ml.matched && !ml.issues.length, 'Mill line matches its docket with no differences');
  await run('mill', 'pacific', 'MK0001', '--tonnes=27.93');
  ok(!(await run('reconcile')).some((x) => x.docket === 'MK0001'), 'Mill tonnes exactly 2% under the docket are inside tolerance');
  await run('mill', 'pacific', 'MK0001', '--tonnes=27.9');
  ok((await run('reconcile')).some((x) => x.docket === 'MK0001' && x.issue === 'TONNES DIFFER'), 'Just over 2% under is flagged');
  await fail(['mill', 'manawatu', 'MK0001', '--tonnes=27'], /another buyer/);
  ok((await run('mill', 'manawatu', 'ZZ404', '--tonnes=25')).matched === false && (await run('reconcile')).some((x) => x.issue === 'NO DOCKET' && x.docket === 'ZZ404'), 'A mill line with no docket is kept and flagged');

  // Money: invoice everything received; buyer-created needs their reference; paid
  const mws = (await db.query(`select count(*)::int as n from v_loads where customer='Manawatu Sawmills' and state='received' and invoice_id is null`))[0].n;
  const inv = await run('invoice', 'manawatu');
  ok(inv.loads === mws && inv.sent === false && !inv.buyer_created, 'Invoice takes every received load for the buyer and sends nothing');
  ok(!(await attention('NOT INVOICED')).some((x) => x.record === 'Manawatu Sawmills'), 'Nothing received from Manawatu is left uninvoiced');
  await fail(['invoice', 'manawatu'], /Nothing received/);
  await fail(['invoice', 'pacific'], /--ref/);
  const st = await run('invoice', 'pacific', '--ref=PLE-ST-2300');
  ok(st.buyer_created && st.invoice === 'PLE-ST-2300', "A buyer-created statement is recorded under the buyer's reference");
  const paid = await run('paid', 'KFM-0002');
  ok(paid.paid_on && !(await attention('INVOICE OVERDUE')).length, 'Paying the overdue invoice clears it');
  await fail(['paid', 'KFM-0002'], /already paid/);

  // Owner return for last month: every received load, net equals sales less costs
  const lastMonth = (await one(`select to_char(date_trunc('month',current_date)-interval '1 month','YYYY-MM') as m`)).m;
  const ret = await run('owner-return', 'te awa', `--month=${lastMonth}`);
  const r = await one('select * from owner_returns where number=$1', [ret.owner_return]);
  ok(ret.loads > 10 && Number(r.sales_cents) - Number(r.costs_cents) === Number(r.net_cents), 'Owner return: net is sales less costs');
  ok(!(await attention('OWNER RETURN DUE')).some((x) => x.record.endsWith(lastMonth) && x.record.startsWith('Te Awa')), 'The return clears the month');
  await fail(['owner-return', 'te awa', `--month=${lastMonth}`], /already on a return/);
  await fail(['owner-return', 'te awa', '--month=2026-13'], /not YYYY-MM/);

  // Contractor pay: buyer-created with agreement and GST number; warned without
  const pay = await run('contractor-pay', 'ridgeline', `--to=${day(-1)}`);
  ok(pay.buyer_created && pay.loads > 10 && !pay.warnings.length, 'Logging crew paid on a buyer-created invoice');
  const haul = await run('contractor-pay', 'hauraki', `--to=${day(-1)}`);
  ok(haul.warnings.some((w) => /no GST number/.test(w)) && haul.gst === '$0', 'Carrier with no GST number is warned and charged no GST');
  const tui = await run('contractor-pay', 'tui', `--to=${day(-1)}`);
  ok(!tui.buyer_created && tui.warnings.some((w) => /pay schedule/.test(w)), 'Carrier with no agreement gets a pay schedule, not a buyer-created invoice');
  ok(!(await attention('CONTRACTOR PAY DUE')).length, 'Pay runs clear contractor pay due');
  await run('update', 'contractors', 'hauraki', '--gst_number=91-234-567');
  ok(!(await findings('BCTI-GST-NUMBERS')).some((x) => x.record.startsWith('Hauraki')), 'Adding the GST number clears the finding');
  await run('update', 'customers', 'central pulp', `--bcti_agreement_on=${day(-200)}`);
  ok(!(await findings('BCTI-AGREEMENT')).some((x) => x.record.startsWith('Central')), 'Recording the buyer agreement clears it');
  await fail(['add', 'contractors', '--name=Bad', '--kind=logging', '--colour=blue'], /Unknown field/);

  // Levy: the owner's undeducted levy for last month, paid, clears the finding
  const levy = await run('levy-paid', 'te awa', `--month=${lastMonth}`);
  ok(Number(levy.tonnes) > 0 && !(await findings('LEVY-UNACCOUNTED')).some((x) => x.record.endsWith(lastMonth)), 'Recording the owner levy payment clears the finding');
  const rate = await one(`select round(levy_due_cents::numeric/tonnes) as c from v_levy where owner='Te Awa Whanau Trust' and to_char(month,'YYYY-MM')=$1`, [lastMonth]);
  ok(Number(rate.c) === 33, 'Levy is 33 cents a tonne from settings');

  // Insights: all ten run
  const insights = await run('insights');
  ok(insights.length === 10 && insights.every((i) => Array.isArray(i.rows)), 'All ten insights run');
  ok(insights[1].rows.some((x) => x.harvest === 'TAW-H03' && Number(x.owner_net_per_t) > 0), 'Insight 2 works out owner net per tonne by harvest');
  ok(insights[8].rows.some((x) => Number(x.overweight) > 0), 'Insight 9 counts overweight loads by truck');
  ok(insights[9].rows.some((x) => x.harvest === 'TAW-H03' && Number(x.working_days_left) > 0), 'Insight 10 estimates working days left');
  await fail(['insights', '11'], /1 through 10/);

  // Add a harvest and a rate in dollars
  const op = await run('add', 'operations', '--forest_id=McKenzie', '--code=MCK-H02', '--crew_id=Kauri', '--rate=35.50', '--est_tonnes=1200');
  ok(Number(op.logging_rate_cents) === 3550, 'Add takes a logging rate in dollars');

  // Imports: PSLog dockets (dry run writes nothing), then the mill statement
  await run('add', 'operations', '--code=PSL-DEMO', '--forest_id=Te Awa Forest', '--status=active');
  const dockets = path.join(REPO_ROOT, 'examples', 'pslog', 'dockets.csv');
  const statement = path.join(REPO_ROOT, 'examples', 'pslog', 'mill-statement.csv');
  const dry = await run('import', 'pslog', `--file=${dockets}`, '--dry-run');
  ok(dry.created === 4 && (await count('dockets', `number like 'PS1002%'`)) === 0, 'Import dry run counts and writes nothing');
  const real = await run('import', 'pslog', `--file=${dockets}`);
  ok(real.created === 4 && real.products_added === 1 && real.trucks_added === 1 && real.carriers_added === 1, 'Import creates dockets and an unknown grade, truck and carrier');
  const ps = await one(`select loaded_on,docket_tonnes from v_loads where docket='PS100231'`);
  ok(ps.loaded_on === '2026-08-03' && Number(ps.docket_tonnes) === 32.27, 'Import reads DD/MM/YYYY and works out net tonnes');
  ok(Number((await one(`select docket_tonnes from v_loads where docket='PS100234'`)).docket_tonnes) === 24.87, 'Import keeps a nett-only load');
  ok((await run('import', 'pslog', `--file=${dockets}`)).updated === 4, 'A second docket import updates, never duplicates');
  const mill = await run('import', 'mill', '--customer=manawatu', `--file=${statement}`);
  ok(mill.created === 3 && mill.unmatched === 1, 'Mill statement import matches dockets and keeps the unmatched line');
  ok(Number((await one(`select mill_value_cents from v_loads where docket='PS100232'`)).mill_value_cents) === 521235, 'Mill value comes across in cents');
  const bad = path.join(temp, 'bad.csv');
  fs.writeFileSync(bad, 'Docket No,Docket Date,Setting,Product,Destination,Nett\nX1,01/08/2026,NOPE,A,Pacific Log Exports,20\n');
  await fail(['import', 'pslog', `--file=${bad}`], /not set up/);
  await fail(['import', 'pslog', '--file=dockets.xlsx'], /as CSV/);
  await fail(['import', 'mill', `--file=${statement}`], /--customer/);
  await fail(['import', 'xero', `--file=${statement}`], /Supported imports/);

  // Export
  const exp = await run('export', `--out=${path.join(temp, 'backup.json')}`);
  ok(exp.counts.dockets > 100 && exp.counts.mill_lines > 100 && fs.existsSync(exp.file), 'Export writes every record');

  // Drafts: written to drafts/, never sent, no em dashes
  for (const args of [['weekly-review'], ['draft-owner-update', 'te awa'], ['draft-notice', 'TAW-H04'], ['draft-notice', 'RNG-H01', '--kind=replant']]) {
    const d = await run(...args);
    const text = fs.readFileSync(d.file, 'utf8');
    ok(d.sent === false && /draft only/i.test(text), `Draft ${args.join(' ')} written, not sent`);
    ok(!text.includes('\u2014'), `Draft ${args[0]} has no em dash`);
  }
  ok(/regulation 64/.test(fs.readFileSync((await run('draft-notice', 'MCK-H01')).file, 'utf8')), 'Harvest notice cites regulation 64');
  await fail(['draft-notice', 'MCK-H02'], /no planned start/);
  const chaser = await run('draft-chaser', inv.invoice);
  ok(chaser.sent === false && fs.readFileSync(chaser.file, 'utf8').includes(inv.invoice), 'Payment chaser drafted for an open invoice');
  await fail(['draft-chaser', 'KFM-0002'], /was paid/);

  // Finish a harvest
  ok((await run('finish', 'MCK-H01')).status === 'finished' && (await attention('REPLANT NOT PLANNED')).some((x) => x.harvest === 'MCK-H01'), 'Finishing a harvest with no replant date shows on attention');

  // Human output renders every shape
  ok(human(await run('attention')).includes('REPLANT NOT PLANNED') && human(await run('harvest', 'TAW-H03')).includes('grade mix'), 'Human tables render');

  // Documents and views render from the same database
  await db.close();
  const env = { ...process.env };
  for (const [script, expect] of [['docs.mjs', /document\(s\) rendered/], ['view.mjs', /view: /]]) {
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { cwd: temp, env, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    ok(expect.test(res.stdout), `${script} renders`);
  }
  for (const docName of ['owner-return', 'contractor-invoice', 'invoice', 'harvest-notice', 'levy-summary']) {
    const out = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'docs.mjs'), docName], { cwd: temp, env, encoding: 'utf8' }).stdout;
    ok(/[1-9]\d* document\(s\) rendered/.test(out), `${docName} documents render`);
  }

  console.log(`\nPASS: ${checks} checks`);
} finally {
  try { await db.close(); } catch {}
  if (control) { await control.query(`drop schema ${schema} cascade`); await control.end(); }
  fs.rmSync(temp, { recursive: true, force: true });
}
