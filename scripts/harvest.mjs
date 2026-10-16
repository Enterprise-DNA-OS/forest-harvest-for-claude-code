#!/usr/bin/env node
// One CLI for the forest harvest database. Human tables by default, --json for machines.
//   node scripts/harvest.mjs help
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, money } from './lib/format.mjs';

// Writable fields per record kind. Anything else is rejected.
export const entities = {
  owners: ['name', 'contact_name', 'email', 'phone', 'gst_number', 'mgmt_fee_cents_per_tonne'],
  forests: ['owner_id', 'name', 'region', 'regional_council', 'territorial_authority', 'area_ha'],
  contractors: ['name', 'kind', 'contact_name', 'email', 'gst_number', 'bcti_agreement_on', 'bcti_reason', 'payment_terms_days'],
  customers: ['name', 'kind', 'contact_name', 'email', 'gst_number', 'payment_terms_days', 'buyer_created', 'bcti_agreement_on', 'bcti_reason'],
  products: ['code', 'name', 'market'],
  trucks: ['carrier_id', 'rego', 'fleet_no', 'max_gross_kg'],
  operations: ['forest_id', 'code', 'name', 'crew_id', 'status', 'salvage', 'est_tonnes', 'area_ha', 'logging_rate_cents', 'planned_start', 'planned_end', 'started_on', 'finished_on',
    'notice_given_on', 'plan_in_place_on', 'replant_planned_on', 'replant_notice_on', 'replanted_on', 'external_id'],
  cartage_rates: ['carrier_id', 'customer_id', 'from_on', 'rate_cents'],
  dockets: ['number', 'operation_id', 'product_id', 'customer_id', 'truck_id', 'loaded_on', 'gross_kg', 'tare_kg', 'net_tonnes', 'note', 'external_id'],
  invoices: ['customer_id', 'number', 'buyer_created', 'issued_on', 'due_on', 'amount_cents', 'gst_cents', 'paid_on'],
  owner_returns: ['number', 'issued_on', 'paid_on'],
  contractor_payments: ['number', 'issued_on', 'paid_on'],
  holidays: ['on_date', 'name'],
  notes: ['operation_id', 'owner_id', 'title', 'body'],
};
// Which column a person uses to name a record, and which table a reference field points at.
const label = { owners: 'name', forests: 'name', contractors: 'name', customers: 'name', products: 'code', trucks: 'rego', operations: 'code', cartage_rates: 'from_on',
  dockets: 'number', invoices: 'number', owner_returns: 'number', contractor_payments: 'number', holidays: 'name', notes: 'title' };
const refs = { owner_id: 'owners', forest_id: 'forests', crew_id: 'contractors', carrier_id: 'contractors', contractor_id: 'contractors', customer_id: 'customers',
  product_id: 'products', truck_id: 'trucks', operation_id: 'operations' };
// Money flags in dollars, stored in cents.
const dollarFlags = { rate: ['logging_rate_cents', 'rate_cents'], fee: ['mgmt_fee_cents_per_tonne'], amount: ['amount_cents'] };

const need = (v, msg) => { if (v === undefined || v === null || v === '' || v === true) throw Error(msg); return v; };
const entity = (v) => { if (!Object.hasOwn(entities, v)) throw Error(`Unknown kind ${v}. Choose ${Object.keys(entities).join(', ')}`); return v; };
const today = () => new Date().toISOString().slice(0, 10);
const settingsOf = async (db) => (await db.query('select * from settings'))[0];

export function parseArgs(args) {
  const pos = [], flags = {};
  for (const s of args) {
    if (s.startsWith('--')) { const i = s.indexOf('='); flags[s.slice(2, i < 0 ? undefined : i)] = i < 0 ? true : s.slice(i + 1); }
    else pos.push(s);
  }
  return { pos, flags };
}

// Exact id or name first (case-insensitive), then id prefix or name fragment. One match or an error listing them.
export async function resolve(db, kind, value) {
  entity(kind); need(value, `Specify a ${kind} name or id`);
  const key = label[kind];
  let rows = await db.query(`select * from ${kind} where id::text=$1 or lower(${key}::text)=lower($1)`, [String(value)]);
  if (!rows.length) rows = await db.query(`select * from ${kind} where starts_with(id::text,lower($1)) or position(lower($1) in lower(${key}::text))>0 order by ${key}`, [String(value)]);
  if (rows.length !== 1) {
    const error = Error(rows.length ? `Ambiguous ${kind}: ${rows.slice(0, 12).map((r) => `${r.id} ${r[key]}`).join('; ')}${rows.length > 12 ? ` and ${rows.length - 12} more` : ''}` : `No ${kind} match: ${value}`);
    error.matches = rows.map((r) => ({ id: r.id, name: r[key] }));
    throw error;
  }
  return rows[0];
}

function cents(v) {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[$,\s]|NZD|AUD/gi, ''));
  if (!Number.isFinite(n)) throw Error(`Not an amount: ${v}`);
  return Math.round(n * 100);
}

function num(v, where) {
  if (v === null || v === undefined || v === '' || v === true) return null;
  const n = Number(String(v).replace(/[,\s]|kg|t$/gi, ''));
  if (!Number.isFinite(n)) throw Error(`${where}: "${v}" is not a number`);
  return n;
}

function toDate(v, where = 'Date') {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const d = s.match(/^(\d{1,2})[/-](\d{1,2}|[A-Za-z]{3})[/-](\d{2,4})/);
    if (d) {
      const mon = /^\d/.test(d[2]) ? d[2].padStart(2, '0') : String(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(d[2].toLowerCase()) + 1).padStart(2, '0');
      m = [null, d[3].length === 2 ? `20${d[3]}` : d[3], mon, d[1].padStart(2, '0')];
    }
  }
  if (!m) throw Error(`${where}: "${s}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`);
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (Number.isNaN(Date.parse(iso + 'T00:00:00Z')) || new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) !== iso) throw Error(`${where}: "${s}" is not a real date`);
  return iso;
}

function month(v) {
  const m = String(need(v, 'Specify --month=YYYY-MM')).match(/^(\d{4})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw Error(`--month: "${v}" is not YYYY-MM`);
  const start = `${m[1]}-${m[2]}-01`;
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
  return { start, end };
}

export const insightQueries = [
  ['Which buyers pay us slowest, against their own payment terms?',
    `select c.name as customer,count(*)::int as invoices_paid,round(avg(i.paid_on-i.issued_on))::int as avg_days_to_pay,c.payment_terms_days as terms,
      round(avg(i.paid_on-i.issued_on))::int-c.payment_terms_days as days_over_terms,
      (select count(*) from invoices u where u.customer_id=c.id and u.paid_on is null)::int as unpaid_now
     from invoices i join customers c on c.id=i.customer_id where i.paid_on is not null group by c.id order by avg_days_to_pay desc`],
  ['What did each harvest return to the owner per tonne, after logging, cartage, levy and fees?',
    `select harvest,owner,round(sum(tonnes))::int as tonnes,round(sum(sale_cents)/sum(tonnes)/100.0,2) as sale_per_t,round(sum(logging_cents)/sum(tonnes)/100.0,2) as logging_per_t,
      round(sum(cartage_cents)/sum(tonnes)/100.0,2) as cartage_per_t,round(sum(levy_cents)/sum(tonnes)/100.0,2) as levy_per_t,round(sum(mgmt_cents)/sum(tonnes)/100.0,2) as fee_per_t,
      round(sum(owner_net_cents)/sum(tonnes)/100.0,2) as owner_net_per_t
     from v_owner_lines group by harvest,owner order by owner_net_per_t desc`],
  ["What is each harvest's grade mix, and what does each grade earn per tonne?",
    `select l.harvest,l.product,l.market,round(sum(l.tonnes))::int as tonnes,round(100*sum(l.tonnes)/max(h.total))::int as pct_of_harvest,round(sum(l.sale_cents)/sum(l.tonnes)/100.0,2) as sale_per_t
     from v_loads l join (select harvest,sum(tonnes) as total from v_loads group by harvest) h on h.harvest=l.harvest group by l.harvest,l.product,l.market order by l.harvest,tonnes desc`],
  ['Which buyer paid best for each grade in the last 90 days?',
    `select product,customer,round(sum(tonnes))::int as tonnes,round(sum(sale_cents)/sum(tonnes)/100.0,2) as sale_per_t,
      rank() over (partition by product order by sum(sale_cents)/sum(tonnes) desc)::int as rank_for_grade
     from v_loads where loaded_on>=current_date-90 group by product,customer order by product,rank_for_grade`],
  ['Which dockets are missing from mill statements, and what are they worth?',
    `select l.customer,l.docket,l.harvest,l.loaded_on,current_date-l.loaded_on as days,l.docket_tonnes,round(l.expected_cents/100.0) as value
     from v_loads l cross join settings s where l.state='in transit' and l.loaded_on<current_date-s.mill_match_days order by days desc`],
  ['Where do mill tonnes differ from our docket tonnes, by buyer?',
    `select l.customer,count(*)::int as loads_received,round(sum(l.docket_tonnes),1) as docket_tonnes,round(sum(l.mill_tonnes),1) as mill_tonnes,
      round(sum(l.mill_tonnes)-sum(l.docket_tonnes),1) as difference,round(100*(sum(l.mill_tonnes)-sum(l.docket_tonnes))/sum(l.docket_tonnes),2) as pct,
      count(*) filter (where abs(l.mill_tonnes-l.docket_tonnes)>l.docket_tonnes*s.tonnage_tolerance_pct/100)::int as loads_over_tolerance
     from v_loads l cross join settings s where l.mill_tonnes is not null group by l.customer order by pct`],
  ['What does cartage cost per tonne to each buyer, against what the load earns there?',
    `select customer,coalesce(carrier,'(no truck)') as carrier,count(*)::int as loads,round(sum(cartage_cents)/sum(tonnes)/100.0,2) as cartage_per_t,round(sum(sale_cents)/sum(tonnes)/100.0,2) as sale_per_t,
      round(100.0*sum(cartage_cents)/nullif(sum(sale_cents),0),1) as cartage_pct_of_sale,round((sum(sale_cents)-sum(cartage_cents))/sum(tonnes)/100.0,2) as at_skid_per_t
     from v_loads group by customer,carrier order by customer,cartage_per_t`],
  ['Which crews produce the most tonnes per working day?',
    `select coalesce(crew,'(no crew)') as crew,string_agg(distinct harvest,', ') as harvests,count(distinct loaded_on)::int as days_loading,count(*)::int as loads,round(sum(tonnes))::int as tonnes,
      round(sum(tonnes)/count(distinct loaded_on),1) as tonnes_per_day,round(count(*)::numeric/count(distinct loaded_on),1) as loads_per_day
     from v_loads group by crew order by tonnes_per_day desc`],
  ['Which trucks run heavy or light against what they may carry?',
    `select coalesce(truck,'(none)') as truck,carrier,max(max_gross_kg) as allowed_kg,count(*)::int as loads,round(avg(gross_kg))::int as avg_gross_kg,round(avg(docket_tonnes),1) as avg_net_t,
      round(100.0*avg(gross_kg)/max(max_gross_kg),1) as pct_of_allowed,count(*) filter (where gross_kg>max_gross_kg)::int as overweight
     from v_loads where gross_kg is not null group by truck,carrier order by pct_of_allowed desc`],
  ['How many tonnes are left on each harvest, and when does it finish at the current pace?',
    `select h.harvest,h.forest,h.crew,h.est_tonnes,h.tonnes,h.tonnes_left,r.recent_per_day,ceil(h.tonnes_left/nullif(r.recent_per_day,0))::int as working_days_left,h.owner_net_per_tonne
     from v_harvests h left join lateral (select round(sum(tonnes)/nullif(count(distinct loaded_on),0),1) as recent_per_day from v_loads l
       where l.operation_id=h.operation_id and l.loaded_on>=current_date-14) r on true where h.status='active' order by working_days_left`],
];

const reads = {
  owners: `select ow.id,ow.name,ow.contact_name,ow.email,ow.gst_number,round(ow.mgmt_fee_cents_per_tonne/100.0,2) as fee_per_t,(select string_agg(f.name,', ') from forests f where f.owner_id=ow.id) as forests from owners ow order by ow.name`,
  forests: `select f.id,f.name,ow.name as owner,f.region,f.regional_council,f.territorial_authority,f.area_ha from forests f join owners ow on ow.id=f.owner_id order by f.name`,
  customers: `select c.id,c.name,c.kind,c.payment_terms_days as terms,c.buyer_created,c.bcti_agreement_on,c.gst_number from customers c order by c.name`,
  contractors: `select k.id,k.name,k.kind,k.gst_number,k.bcti_agreement_on,k.payment_terms_days as terms,(select string_agg(t.rego,', ') from trucks t where t.carrier_id=k.id) as trucks from contractors k order by k.kind,k.name`,
  trucks: `select t.id,t.rego,t.fleet_no,k.name as carrier,coalesce(t.max_gross_kg,s.default_max_gross_kg) as max_gross_kg from trucks t join contractors k on k.id=t.carrier_id cross join settings s order by k.name,t.rego`,
  products: `select id,code,name,market from products order by market,code`,
  harvests: `select operation_id as id,harvest,forest,owner,crew,status,est_tonnes,tonnes,loads,tonnes_per_day,tonnes_left,sales,owner_net,owner_net_per_tonne,started_on from v_harvests
    order by case status when 'active' then 1 when 'planned' then 2 when 'finished' then 3 else 4 end,harvest`,
  prices: `select c.name as customer,p.code as product,p.market,x.from_on,round(x.price_cents/100.0,2) as price_per_t from customers c cross join products p
    join lateral (select from_on,price_cents from sale_prices sp where sp.customer_id=c.id and sp.product_id=p.id and sp.from_on<=current_date order by from_on desc limit 1) x on true order by p.market,p.code,price_per_t desc`,
  receivables: `select state,customer,description,round(amount_cents/100.0) as amount,since,days from v_receivables order by case state when 'overdue' then 1 when 'not invoiced' then 2 else 3 end,days desc`,
  invoices: `select i.id,c.name as customer,i.number,i.buyer_created,i.issued_on,i.due_on,i.paid_on,round(i.amount_cents/100.0) as amount,round((i.amount_cents+i.gst_cents)/100.0) as incl_gst,
    case when i.paid_on is not null then 'paid' when i.due_on<current_date then 'overdue' else 'open' end as state from invoices i join customers c on c.id=i.customer_id order by i.issued_on desc`,
  returns: `select r.id,ow.name as owner,r.number,r.period_start,r.period_end,r.issued_on,r.tonnes,round(r.sales_cents/100.0) as sales,round(r.costs_cents/100.0) as costs,round(r.net_cents/100.0) as net,r.paid_on
    from owner_returns r join owners ow on ow.id=r.owner_id order by r.issued_on desc`,
  pays: `select p.id,k.name as contractor,p.number,p.kind,p.buyer_created,p.period_end,p.issued_on,p.tonnes,round(p.amount_cents/100.0) as amount,round((p.amount_cents+p.gst_cents)/100.0) as incl_gst,p.paid_on
    from contractor_payments p join contractors k on k.id=p.contractor_id order by p.issued_on desc`,
  levy: `select owner,to_char(month,'YYYY-MM') as month,tonnes,round(levy_due_cents/100.0,2) as levy_due,round(deducted_by_buyers_cents/100.0,2) as deducted_by_buyers,
    round(owner_to_pay_cents/100.0,2) as owner_to_pay,owner_paid_on from v_levy order by month desc,owner`,
  notices: `select harvest,forest,kind,starts_on,window_opens,give_by,given_on,plan_by,plan_in_place_on,
    case when given_on is null and give_by<current_date then 'late' when given_on is null then 'to give' when given_on>give_by then 'given late' when given_on<window_opens then 'given too early' else 'given' end as state
    from v_notices order by starts_on`,
  reconcile: `select issue,customer,docket,on_date,docket_tonnes,mill_tonnes,detail from v_reconcile order by issue,on_date`,
  compliance: `select rule,harvest,record,finding,due_date,source from v_compliance order by rule,record`,
};

async function filtered(db, sql, f) {
  let rows = await db.query(sql);
  if (f.harvest) { const o = await resolve(db, 'operations', f.harvest); rows = rows.filter((r) => !('harvest' in r) || r.harvest === o.code); }
  if (f.customer) { const c = await resolve(db, 'customers', f.customer); rows = rows.filter((r) => !('customer' in r) || r.customer === c.name); }
  if (f.owner) { const o = await resolve(db, 'owners', f.owner); rows = rows.filter((r) => !('owner' in r) || r.owner === o.name); }
  return rows;
}

const loadCols = `docket,loaded_on,harvest,product,customer,truck,gross_kg,docket_tonnes,mill_tonnes,state,round(sale_cents/100.0,2) as value`;

export async function execute(db, args) {
  const { pos, flags: f } = parseArgs(args);
  const [cmd = 'help', sub, ...rest] = pos;
  if (cmd === 'help' || f.help) return {
    commands: ['harvests', 'owners', 'forests', 'customers', 'contractors', 'trucks', 'products', 'prices', 'dockets [--since=date]', 'notices', 'reconcile', 'receivables', 'invoices',
      'returns', 'pays', 'levy', 'compliance', 'attention', 'harvest <code>', 'docket <number>', 'owner <name>', 'insights [1..10]',
      'show <kind> <name|id>', 'add <kind> --field=value', 'update <kind> <name|id> --field=value',
      'load <docket> --harvest= --product= --customer= --truck= --gross=kg --tare=kg [--net=t] [--on=date]',
      'mill <customer> <docket> --tonnes= [--value=dollars] [--levy=dollars] [--on=date] [--ref=statement]',
      'price <customer> <product> <dollars per tonne> [--from=date]', 'notice <harvest> --kind=harvest|plan|replant [--on=date]',
      'start <harvest> [--on=date]', 'finish <harvest> [--on=date]', 'invoice <customer> [--to=date] [--ref=buyer statement] [--on=date]', 'paid <invoice|return|pay> [--on=date]',
      'owner-return <owner> --month=YYYY-MM [--on=date]', 'contractor-pay <contractor> [--to=date] [--on=date]', 'levy-paid <owner> --month=YYYY-MM [--on=date]',
      'log <harvest> <note>', 'import pslog --file=dockets.csv [--harvest=code] [--dry-run]', 'import mill --customer=<buyer> --file=statement.csv [--dry-run]', 'export --out=backup.json',
      'weekly-review', 'draft-owner-update <owner>', 'draft-notice <harvest> [--kind=harvest|replant]', 'draft-chaser <invoice>'],
    note: 'Reads accept --harvest=, --customer=, --owner= and --json. Money flags (--rate, --fee, --value, --levy, prices) are dollars; *_cents fields are cents. Weights are kg, tonnes are t. Drafts go to drafts/ and are never sent.',
  };

  if (reads[cmd]) return filtered(db, reads[cmd], f);

  if (cmd === 'dockets') {
    const since = toDate(f.since || null, '--since');
    const rows = await filtered(db, `select ${loadCols} from v_loads ${since ? `where loaded_on>='${since}'` : ''} order by loaded_on desc,docket desc`, f);
    return f.all || since ? rows : rows.slice(0, 40);
  }

  if (cmd === 'attention') {
    const rows = await db.query(`select * from v_attention order by case when item like 'NOTICE%' or item like 'PLAN%' then 1 when item='OVERWEIGHT' then 2 when item like 'MILL%' then 3
      when item='INVOICE OVERDUE' then 4 when item in ('NOT INVOICED','STATEMENT DUE') then 5 else 6 end,due_date`);
    if (!f.harvest) return rows;
    const o = await resolve(db, 'operations', f.harvest);
    return rows.filter((r) => !r.harvest || r.harvest === o.code);
  }

  if (cmd === 'harvest') {
    const o = await resolve(db, 'operations', sub);
    return {
      harvest: (await db.query(`select h.*,o.salvage,round(o.logging_rate_cents/100.0,2) as logging_rate_per_t,o.planned_start,o.planned_end,o.notice_given_on,o.plan_in_place_on,o.replant_planned_on,o.replant_notice_on,o.replanted_on
        from v_harvests h join operations o on o.id=h.operation_id where h.operation_id=$1`, [o.id]))[0],
      grade_mix: await db.query(`select product,customer,count(*)::int as loads,round(sum(tonnes),1) as tonnes,round(sum(sale_cents)/sum(tonnes)/100.0,2) as sale_per_t from v_loads where operation_id=$1 group by product,customer order by tonnes desc`, [o.id]),
      last_7_days: await db.query(`select loaded_on,count(*)::int as loads,round(sum(tonnes),1) as tonnes from v_loads where operation_id=$1 and loaded_on>=current_date-7 group by loaded_on order by loaded_on`, [o.id]),
      notices: await db.query(`select kind,starts_on,window_opens,give_by,given_on,plan_by,plan_in_place_on from v_notices where operation_id=$1`, [o.id]),
      findings: await db.query(`select rule,record,finding from v_compliance where harvest=$1 order by rule`, [o.code]),
      notes: await db.query(`select title,body,created_at from notes where operation_id=$1 order by created_at`, [o.id]),
    };
  }

  if (cmd === 'docket') {
    const d = await resolve(db, 'dockets', sub);
    return (await db.query(`select docket,loaded_on,harvest,forest,owner,product,customer,truck,carrier,crew,gross_kg,max_gross_kg,docket_tonnes,mill_tonnes,received_on,state,
      round(price_cents/100.0,2) as price_per_t,round(sale_cents/100.0,2) as sale,round(logging_cents/100.0,2) as logging,round(cartage_cents/100.0,2) as cartage,
      round(levy_cents/100.0,2) as levy,round(levy_deducted_cents/100.0,2) as levy_deducted_by_buyer,round(mgmt_cents/100.0,2) as mgmt_fee,round(owner_net_cents/100.0,2) as owner_net,
      (select number from invoices where id=invoice_id) as invoice,(select number from owner_returns where id=owner_return_id) as owner_return
      from v_owner_lines where id=$1`, [d.id]))[0];
  }

  if (cmd === 'owner') {
    const ow = await resolve(db, 'owners', sub);
    return {
      owner: (await db.query('select name,contact_name,email,phone,gst_number,round(mgmt_fee_cents_per_tonne/100.0,2) as fee_per_t from owners where id=$1', [ow.id]))[0],
      harvests: await db.query('select harvest,forest,status,est_tonnes,tonnes,owner_net,owner_net_per_tonne from v_harvests where owner=$1 order by harvest', [ow.name]),
      not_yet_on_a_return: await db.query(`select to_char(date_trunc('month',loaded_on),'YYYY-MM') as month,count(*)::int as loads,round(sum(tonnes),1) as tonnes,round(sum(owner_net_cents)/100.0) as owner_net
        from v_owner_lines where owner_id=$1 and owner_return_id is null and state='received' group by 1 order by 1`, [ow.id]),
      returns: await db.query('select number,period_start,period_end,issued_on,tonnes,round(net_cents/100.0) as net,paid_on from owner_returns where owner_id=$1 order by issued_on desc', [ow.id]),
      levy: await db.query(`select to_char(month,'YYYY-MM') as month,tonnes,round(owner_to_pay_cents/100.0,2) as owner_to_pay,owner_paid_on from v_levy where owner_id=$1 order by month desc`, [ow.id]),
      notes: await db.query('select title,body,created_at from notes where owner_id=$1 order by created_at', [ow.id]),
    };
  }

  if (cmd === 'insights') {
    if (sub !== undefined && !/^([1-9]|10)$/.test(sub)) throw Error('Choose insight 1 through 10');
    const out = [];
    for (let i = 0; i < insightQueries.length; i++) {
      if (sub && Number(sub) !== i + 1) continue;
      const [question, sql] = insightQueries[i];
      out.push({ number: i + 1, question, rows: await filtered(db, sql, f) });
    }
    return out;
  }

  if (cmd === 'show') return resolve(db, entity(sub), rest[0]);

  if (cmd === 'add' || cmd === 'update') {
    const kind = entity(sub);
    const old = cmd === 'update' ? await resolve(db, kind, rest[0]) : null;
    const values = {};
    for (const [key, v] of Object.entries(f)) {
      if (key === 'json') continue;
      const money = (dollarFlags[key] || []).find((col) => entities[kind].includes(col));
      if (money) { values[money] = cents(v); continue; }
      if (!entities[kind].includes(key)) throw Error(`Unknown field ${key} for ${kind}`);
      values[key] = v === 'null' ? null : v === true ? 'true' : v;
    }
    for (const [key, target] of Object.entries(refs)) if (values[key] && entities[kind].includes(key)) values[key] = (await resolve(db, target, values[key])).id;
    const keys = Object.keys(values);
    if (!keys.length) throw Error('Supply at least one field');
    const params = Object.values(values);
    const sql = cmd === 'add'
      ? `insert into ${kind} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`
      : `update ${kind} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(',')} where id=$${params.push(old.id)} returning *`;
    return (await db.query(sql, params))[0];
  }

  // A load leaves the skid: the docket. Values it on the spot and shows anything it trips.
  if (cmd === 'load') {
    const number = need(sub, 'Specify the docket number');
    if ((await db.query('select 1 from dockets where lower(number)=lower($1)', [number])).length) throw Error(`Docket ${number} is already recorded`);
    const o = await resolve(db, 'operations', need(f.harvest, 'Specify --harvest=<code>'));
    if (['planned', 'cancelled', 'replanted'].includes(o.status)) throw Error(`${o.code} is ${o.status}. Start it first (start ${o.code}).`);
    const p = await resolve(db, 'products', need(f.product, 'Specify --product=<grade code>'));
    const c = await resolve(db, 'customers', need(f.customer, 'Specify --customer=<buyer>'));
    const t = f.truck ? await resolve(db, 'trucks', f.truck) : null;
    const on = toDate(f.on || today(), '--on');
    if (on > today()) throw Error(`${on} is in the future. Record a load once it has left the skid.`);
    const gross = num(f.gross, '--gross'), tare = num(f.tare, '--tare'), net = num(f.net, '--net');
    if (net === null && (gross === null || tare === null)) throw Error('Give --gross and --tare in kg, or --net in tonnes');
    if (gross !== null && tare !== null && tare >= gross) throw Error('Tare must be less than gross');
    const row = (await db.query(`insert into dockets (number,operation_id,product_id,customer_id,truck_id,loaded_on,gross_kg,tare_kg,net_tonnes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [number, o.id, p.id, c.id, t?.id || null, on, gross, tare, net]))[0];
    const load = (await db.query(`select ${loadCols},round(price_cents/100.0,2) as price_per_t,round(owner_net_cents/100.0,2) as owner_net,gross_kg>max_gross_kg as overweight from v_owner_lines where id=$1`, [row.id]))[0];
    const warnings = [];
    if (load.overweight) warnings.push(`Gross ${gross} kg is over the ${(await db.query('select max_gross_kg from v_loads where id=$1', [row.id]))[0].max_gross_kg} kg this truck may carry`);
    if (load.price_per_t === null) warnings.push(`No ${p.code} price for ${c.name} on ${on}: add one with price`);
    return { load, warnings };
  }

  // One line off the mill or exporter's statement.
  if (cmd === 'mill') {
    const c = await resolve(db, 'customers', sub);
    const number = need(rest[0], 'Specify the docket number');
    const tonnes = need(num(f.tonnes, '--tonnes'), 'Specify --tonnes= (what the mill received)');
    const d = (await db.query('select * from dockets where lower(number)=lower($1)', [number]))[0];
    if (d && d.customer_id !== c.id) throw Error(`Docket ${d.number} went to another buyer, not ${c.name}`);
    const row = (await db.query(`insert into mill_lines (customer_id,docket_number,docket_id,received_on,tonnes,value_cents,levy_cents,statement_ref) values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (customer_id,docket_number) do update set tonnes=excluded.tonnes,value_cents=coalesce(excluded.value_cents,mill_lines.value_cents),levy_cents=coalesce(excluded.levy_cents,mill_lines.levy_cents),
      received_on=excluded.received_on,statement_ref=coalesce(excluded.statement_ref,mill_lines.statement_ref),docket_id=coalesce(excluded.docket_id,mill_lines.docket_id) returning *`,
      [c.id, d?.number || number, d?.id || null, toDate(f.on || today(), '--on'), tonnes, cents(f.value), cents(f.levy), f.ref || null]))[0];
    const issues = await db.query('select issue,detail from v_reconcile where docket=$1', [row.docket_number]);
    return { docket: row.docket_number, matched: Boolean(row.docket_id), mill_tonnes: row.tonnes, issues };
  }

  if (cmd === 'price') {
    const c = await resolve(db, 'customers', sub);
    const p = await resolve(db, 'products', need(rest[0], 'Specify the grade code'));
    const value = need(cents(rest[1]), 'Specify the price per tonne in dollars');
    const from = toDate(f.from || today(), '--from');
    await db.query(`insert into sale_prices (customer_id,product_id,from_on,price_cents) values ($1,$2,$3,$4) on conflict (customer_id,product_id,from_on) do update set price_cents=excluded.price_cents`, [c.id, p.id, from, value]);
    return { customer: c.name, product: p.code, from_on: from, price_per_t: value / 100 };
  }

  if (cmd === 'notice') {
    const o = await resolve(db, 'operations', sub);
    const col = { harvest: 'notice_given_on', plan: 'plan_in_place_on', replant: 'replant_notice_on' }[f.kind || 'harvest'];
    if (!col) throw Error('--kind must be harvest, plan or replant');
    await db.query(`update operations set ${col}=$1 where id=$2`, [toDate(f.on || today(), '--on'), o.id]);
    return { harvest: o.code, recorded: col, notices: await db.query('select kind,starts_on,window_opens,give_by,given_on,plan_by,plan_in_place_on from v_notices where operation_id=$1', [o.id]),
      findings: await db.query('select rule,finding from v_compliance where harvest=$1', [o.code]) };
  }

  if (cmd === 'start' || cmd === 'finish') {
    const o = await resolve(db, 'operations', sub);
    const on = toDate(f.on || today(), '--on');
    const row = cmd === 'start'
      ? (await db.query(`update operations set status='active',started_on=$1 where id=$2 returning code,status,started_on`, [on, o.id]))[0]
      : (await db.query(`update operations set status='finished',finished_on=$1 where id=$2 returning code,status,started_on,finished_on`, [on, o.id]))[0];
    return { ...row, findings: await db.query('select rule,finding from v_compliance where harvest=$1', [o.code]) };
  }

  // Invoice a buyer for every received load not yet invoiced. A buyer that creates the tax invoice gives you its reference: you record it.
  if (cmd === 'invoice') {
    const c = await resolve(db, 'customers', sub);
    const s = await settingsOf(db);
    const on = toDate(f.on || today(), '--on'), to = toDate(f.to || on, '--to');
    if (c.buyer_created && !f.ref) throw Error(`${c.name} creates the tax invoice for your loads. Record their statement with --ref=<their reference>.`);
    await db.exec('BEGIN');
    try {
      const lines = await db.query(`select id,docket,loaded_on,product,tonnes,sale_cents from v_loads where customer_id=$1 and state='received' and invoice_id is null and loaded_on<=$2 order by loaded_on,docket`, [c.id, to]);
      if (!lines.length) throw Error(`Nothing received and not invoiced for ${c.name}`);
      if (lines.some((l) => l.sale_cents === null)) throw Error(`Some loads have no price: ${lines.filter((l) => l.sale_cents === null).map((l) => l.docket).join(', ')}. Add the price first.`);
      let number = f.ref;
      if (!number) {
        const n = Number((await db.query(`select count(*) as n from invoices where not buyer_created`))[0].n) + 1;
        number = `INV-${String(n).padStart(4, '0')}`;
        while ((await db.query('select 1 from invoices where number=$1', [number])).length) number = `${number}a`;
      }
      const total = lines.reduce((t, l) => t + Number(l.sale_cents), 0);
      const inv = (await db.query(`insert into invoices (customer_id,number,buyer_created,issued_on,due_on,amount_cents,gst_cents) values ($1,$2,$3,$4,$4::date+$5::int,$6,$7) returning *`,
        [c.id, number, c.buyer_created, on, c.payment_terms_days, total, Math.round(total * Number(s.gst_rate))]))[0];
      await db.query(`update dockets set invoice_id=$1 where id = any($2::uuid[])`, [inv.id, lines.map((l) => l.id)]);
      await db.exec('COMMIT');
      return { invoice: inv.number, customer: c.name, buyer_created: inv.buyer_created, issued_on: inv.issued_on, due_on: inv.due_on, loads: lines.length,
        tonnes: Math.round(lines.reduce((t, l) => t + Number(l.tonnes), 0) * 1000) / 1000, excl_gst: money(total), gst: money(inv.gst_cents), sent: false };
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
  }

  if (cmd === 'paid') {
    const on = toDate(f.on || today(), '--on');
    for (const kind of ['invoices', 'owner_returns', 'contractor_payments']) {
      const hit = await db.query(`select * from ${kind} where lower(number)=lower($1)`, [need(sub, 'Specify the invoice, return or pay number')]);
      if (!hit.length) continue;
      if (hit[0].paid_on) throw Error(`${hit[0].number} is already paid on ${hit[0].paid_on}`);
      return (await db.query(`update ${kind} set paid_on=$1 where id=$2 returning number,issued_on,paid_on,paid_on-issued_on as days_to_pay`, [on, hit[0].id]))[0];
    }
    const i = await resolve(db, 'invoices', sub);
    if (i.paid_on) throw Error(`${i.number} is already paid on ${i.paid_on}`);
    return (await db.query('update invoices set paid_on=$1 where id=$2 returning number,issued_on,due_on,paid_on,paid_on-issued_on as days_to_pay', [on, i.id]))[0];
  }

  // The owner's return for a month: every received load, what it sold for, every cost, the net.
  if (cmd === 'owner-return') {
    const ow = await resolve(db, 'owners', sub);
    const { start, end } = month(f.month);
    const on = toDate(f.on || today(), '--on');
    await db.exec('BEGIN');
    try {
      const lines = await db.query(`select id,tonnes,sale_cents,owner_net_cents from v_owner_lines where owner_id=$1 and state='received' and owner_return_id is null and loaded_on between $2 and $3`, [ow.id, start, end]);
      if (!lines.length) throw Error(`No received loads for ${ow.name} in ${f.month} that are not already on a return`);
      if (lines.some((l) => l.sale_cents === null)) throw Error('Some loads have no price. Add the price first.');
      const sum = (k) => lines.reduce((t, l) => t + Number(l[k]), 0);
      const n = Number((await db.query('select count(*) as n from owner_returns where owner_id=$1', [ow.id]))[0].n) + 1;
      const tag = ow.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      let number = `OR-${tag}-${String(n).padStart(4, '0')}`;
      while ((await db.query('select 1 from owner_returns where number=$1', [number])).length) number = `${number}a`;
      const r = (await db.query(`insert into owner_returns (owner_id,number,period_start,period_end,issued_on,tonnes,sales_cents,costs_cents,net_cents) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [ow.id, number, start, end, on, Math.round(sum('tonnes') * 1000) / 1000, sum('sale_cents'), sum('sale_cents') - sum('owner_net_cents'), sum('owner_net_cents')]))[0];
      await db.query('update dockets set owner_return_id=$1 where id = any($2::uuid[])', [r.id, lines.map((l) => l.id)]);
      await db.exec('COMMIT');
      return { owner_return: r.number, owner: ow.name, period: `${start} to ${end}`, loads: lines.length, tonnes: r.tonnes, sales: money(r.sales_cents), costs: money(r.costs_cents), net_to_owner: money(r.net_cents), sent: false,
        next: 'npm run docs -- owner-return renders the statement' };
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
  }

  // Pay a logging crew or carrier for every load not yet paid. With an agreement on file, you create their tax invoice.
  if (cmd === 'contractor-pay') {
    const k = await resolve(db, 'contractors', sub);
    if (!['logging', 'cartage'].includes(k.kind)) throw Error(`${k.name} is a ${k.kind} contractor. Pay runs cover logging and cartage.`);
    const s = await settingsOf(db);
    const on = toDate(f.on || today(), '--on'), to = toDate(f.to || on, '--to');
    const [who, payCol, costCol] = k.kind === 'logging' ? ['crew_id', 'logging_pay_id', 'logging_cents'] : ['carrier_id', 'cartage_pay_id', 'cartage_cents'];
    await db.exec('BEGIN');
    try {
      const lines = await db.query(`select id,tonnes,${costCol} as amount from v_loads where ${who}=$1 and ${payCol} is null and loaded_on<=$2`, [k.id, to]);
      if (!lines.length) throw Error(`No unpaid ${k.kind} loads for ${k.name} up to ${to}`);
      const amount = lines.reduce((t, l) => t + Number(l.amount), 0);
      const tag = k.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
      const n = Number((await db.query('select count(*) as n from contractor_payments where contractor_id=$1', [k.id]))[0].n) + 1;
      let number = `BC-${tag}-${String(n).padStart(4, '0')}`;
      while ((await db.query('select 1 from contractor_payments where number=$1', [number])).length) number = `${number}a`;
      const buyerCreated = Boolean(k.bcti_agreement_on);
      const p = (await db.query(`insert into contractor_payments (contractor_id,number,kind,buyer_created,period_end,issued_on,tonnes,amount_cents,gst_cents) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [k.id, number, k.kind, buyerCreated, to, on, Math.round(lines.reduce((t, l) => t + Number(l.tonnes), 0) * 1000) / 1000, amount, k.gst_number || !buyerCreated ? Math.round(amount * Number(s.gst_rate)) : 0]))[0];
      await db.query(`update dockets set ${payCol}=$1 where id = any($2::uuid[])`, [p.id, lines.map((l) => l.id)]);
      await db.exec('COMMIT');
      const warnings = [];
      if (buyerCreated && !k.gst_number) warnings.push(`${k.name} has no GST number recorded: a buyer-created tax invoice must show it. GST left at zero until it is added.`);
      if (!buyerCreated) warnings.push(`No buyer-created agreement with ${k.name}: this is a pay schedule. Wait for their tax invoice before paying.`);
      return { pay: p.number, contractor: k.name, kind: k.kind, buyer_created: buyerCreated, loads: lines.length, tonnes: p.tonnes, excl_gst: money(amount), gst: money(p.gst_cents), warnings, sent: false };
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
  }

  if (cmd === 'levy-paid') {
    const ow = await resolve(db, 'owners', sub);
    const { start } = month(f.month);
    const v = (await db.query('select * from v_levy where owner_id=$1 and month=$2', [ow.id, start]))[0];
    if (!v || Number(v.undeducted_tonnes) === 0) throw Error(`No levy for ${ow.name} to pay for ${f.month}: buyers deducted it all, or there were no loads`);
    const row = (await db.query(`insert into levy_payments (owner_id,month,tonnes,amount_cents,paid_on) values ($1,$2,$3,$4,$5)
      on conflict (owner_id,month) do update set tonnes=excluded.tonnes,amount_cents=excluded.amount_cents,paid_on=excluded.paid_on returning *`,
      [ow.id, start, v.undeducted_tonnes, v.owner_to_pay_cents, toDate(f.on || today(), '--on')]))[0];
    return { owner: ow.name, month: f.month, tonnes: row.tonnes, levy: money(row.amount_cents), paid_on: row.paid_on };
  }

  if (cmd === 'log') {
    const o = await resolve(db, 'operations', sub);
    const forest = (await db.query('select owner_id from forests where id=$1', [o.forest_id]))[0];
    return (await db.query('insert into notes (operation_id,owner_id,title,body) values ($1,$2,$3,$4) returning title,body,created_at', [o.id, forest.owner_id, f.title || 'Note', need(rest.join(' '), 'Supply the note text')]))[0];
  }

  if (cmd === 'import') return importer(db, sub, f);

  if (cmd === 'export') {
    const snapshot = { format: 'forest-harvest-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      for (const kind of ['settings', 'holidays', ...Object.keys(entities).filter((k) => k !== 'holidays'), 'sale_prices', 'mill_lines', 'levy_payments']) snapshot.records[kind] = await db.query(`select * from ${kind} order by 1`);
      await db.exec('COMMIT');
    } catch (e) { await db.exec('ROLLBACK'); throw e; }
    const out = path.resolve(need(f.out, 'Specify --out=backup.json'));
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return { file: out, counts: Object.fromEntries(Object.entries(snapshot.records).map(([k, v]) => [k, v.length])) };
  }

  if (cmd === 'weekly-review') {
    const data = { attention: await execute(db, ['attention']), harvests: await execute(db, ['harvests']), compliance: await execute(db, ['compliance']) };
    const s = await settingsOf(db);
    const notices = data.attention.filter((r) => /^(NOTICE|PLAN) DUE$/.test(r.item)).length;
    const mill = data.attention.filter((r) => r.item.startsWith('MILL')).length;
    const lead = notices ? `${notices} council notice(s) or harvesting plan(s) due or late. That comes first.` : mill ? `${mill} mill statement line(s) do not match the dockets.` : 'No notices due and the mill statements match.';
    const week = await db.query(`select harvest,count(*)::int as loads,round(sum(tonnes),1) as tonnes,round(sum(sale_cents)/100.0) as sales from v_loads where loaded_on>=current_date-7 group by harvest order by harvest`);
    return draft('weekly-review', `# ${s.business_name}: weekly harvest review, ${today()}\n\n${lead}\n\n## Last 7 days\n\n${human(week)}\n\n## Needs someone this week\n\n${human(data.attention)}\n\n## Harvests\n\n${human(data.harvests.filter((h) => ['active', 'planned'].includes(h.status)))}\n\n## Record checks\n\n${human(data.compliance.map(({ source, ...r }) => r))}\n\nSources for each rule: docs/compliance.md. Draft only, nothing has been sent.\n`, data);
  }

  if (cmd === 'draft-owner-update') {
    const o = await execute(db, ['owner', sub]);
    const s = await settingsOf(db);
    const first = (o.owner.contact_name || '').split(' ')[0] || 'there';
    const active = o.harvests.filter((h) => Number(h.tonnes) > 0);
    const text = `# Draft only: harvest update for ${o.owner.name}\n\nTo: ${o.owner.contact_name || o.owner.name}${o.owner.email ? ` <${o.owner.email}>` : ''}\nSubject: Your harvest, ${today()}\n\nHi ${first},\n\n` +
      (active.length ? active.map((h) => `${h.harvest} (${h.forest}): ${h.tonnes} t harvested of an estimated ${h.est_tonnes} t. After logging, cartage, levy and our fee it has returned ${money(Number(h.owner_net) * 100)}, about ${money(Number(h.owner_net_per_tonne) * 100)} a tonne.`).join('\n\n') : 'No loads have left your forest yet.') +
      (o.not_yet_on_a_return.length ? `\n\nStill to come on your next return:\n\n${o.not_yet_on_a_return.map((m) => `- ${m.month}: ${m.loads} loads, ${m.tonnes} t, about ${money(Number(m.owner_net) * 100)} to you`).join('\n')}` : '') +
      `\n\nRegards,\n${s.business_name}\n\nNothing has been sent. Check the figures against the latest mill statements before it goes.\n`;
    return draft('owner-update', text, o);
  }

  if (cmd === 'draft-notice') {
    const o = await resolve(db, 'operations', sub);
    const kind = f.kind || 'harvest';
    if (!['harvest', 'replant'].includes(kind)) throw Error('--kind must be harvest or replant');
    const n = (await db.query('select * from v_notices where operation_id=$1 and kind=$2', [o.id, kind]))[0];
    if (!n) throw Error(kind === 'harvest' ? `${o.code} has no planned start date. Set planned_start first.` : `${o.code} has no replanting date. Set replant_planned_on first.`);
    const forest = (await db.query('select f.*,ow.name as owner from forests f join owners ow on ow.id=f.owner_id where f.id=$1', [o.forest_id]))[0];
    const s = await settingsOf(db);
    const what = kind === 'harvest' ? 'harvesting' : 'replanting';
    const end = kind === 'harvest' ? o.planned_end : null;
    const text = `# Draft only: written notice of ${what}\n\nTo: ${[forest.regional_council, forest.territorial_authority].filter(Boolean).join(' and ') || '(the regional council and territorial authority)'}\nFrom: ${s.business_name}, on behalf of ${forest.owner}\n\n` +
      `Under regulation ${kind === 'harvest' ? '64' : '78A'} of the Resource Management (National Environmental Standards for Commercial Forestry) Regulations 2017, we give notice of ${what}.\n\n` +
      `- Place: ${forest.name}${o.name ? `, ${o.name}` : ''}${forest.region ? ` (${forest.region})` : ''}. ${o.area_ha ? `About ${o.area_ha} ha.` : ''} Map attached.\n` +
      `- Planned to begin: ${n.starts_on}\n- Planned to end: ${end || '(add the planned end date)'}\n` +
      (kind === 'harvest' ? `- Harvesting plan: ${o.plan_in_place_on ? `in place ${o.plan_in_place_on}` : 'to be in place by ' + (n.plan_by || n.starts_on)}; available on request.\n` : '- Setbacks: (describe how the setbacks were calculated, or attach the map)\n') +
      `\nFor this notice to count it must be given between ${n.window_opens} and ${n.give_by}.\n\nUse your council's own form if it has one. Nothing has been sent. Once it is sent, record it: notice ${o.code} --kind=${kind} --on=YYYY-MM-DD\n`;
    return draft(`${kind}-notice`, text, n);
  }

  if (cmd === 'draft-chaser') {
    const i = await resolve(db, 'invoices', sub);
    if (i.paid_on) throw Error(`${i.number} was paid on ${i.paid_on}`);
    const c = (await db.query('select * from customers where id=$1', [i.customer_id]))[0];
    const s = await settingsOf(db);
    const lines = await db.query('select docket,loaded_on,product,tonnes,sale_cents from v_loads where invoice_id=$1 order by loaded_on,docket', [i.id]);
    const text = `# Draft only: payment follow-up\n\nTo: ${c.contact_name || c.name}${c.email ? ` <${c.email}>` : ''}\nSubject: ${i.buyer_created ? 'Your statement' : 'Invoice'} ${i.number} due ${i.due_on}\n\nHi ${(c.contact_name || '').split(' ')[0] || 'there'},\n\n` +
      `${i.buyer_created ? 'Your statement' : 'Invoice'} ${i.number} (${money(Number(i.amount_cents) + Number(i.gst_cents))} incl GST, ${lines.length} loads) was due on ${i.due_on}. Could you confirm when it will be paid, or let us know if any docket is holding it up?\n\n` +
      `${lines.slice(0, 15).map((l) => `- ${l.docket}, ${l.loaded_on}, ${l.product}, ${l.tonnes} t: ${money(l.sale_cents)}`).join('\n')}${lines.length > 15 ? `\n- and ${lines.length - 15} more` : ''}\n\nThanks,\n${s.business_name}\n\nNothing has been sent. Review before use.\n`;
    return draft('payment-chaser', text, { invoice: i, lines });
  }

  throw Error(`Unknown command ${cmd}. Run help.`);
}

function draft(prefix, text, data) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${prefix}-${today()}-${Math.random().toString(16).slice(2, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 });
  return { file, data, sent: false };
}

const hidden = (k) => ['id', 'created_at', 'updated_at'].includes(k) || k.endsWith('_id');
export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (typeof value[0] !== 'object' || value[0] === null) return value.map((v) => `  ${v}`).join('\n');
    if (value[0]?.question) return value.map((x) => `${x.number}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => !hidden(k));
    return table(value, keys.map((key) => ({ key, label: key.replaceAll('_', ' '), width: 70, format: (v) => (v instanceof Date ? v.toISOString().slice(0, 16) : v == null ? '' : String(v)) })));
  }
  if (value && typeof value === 'object') {
    const flat = (v) => v === null || typeof v !== 'object' || v instanceof Date;
    const scalars = Object.entries(value).filter(([k, v]) => flat(v) && !hidden(k)).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v instanceof Date ? v.toISOString().slice(0, 16) : v ?? ''}`);
    const nested = Object.entries(value).filter(([, v]) => !flat(v)).map(([k, v]) => `${k.replaceAll('_', ' ')}:\n${human(v)}`);
    return [scalars.join('\n'), ...nested].filter(Boolean).join('\n\n');
  }
  return String(value ?? '');
}

// PSLog docket reports and mill statements, saved from Excel as CSV. Neither publishes fixed column names,
// so the import reads the common labels below; docs/replace-pslog.md says how to add your own.
export const COLUMNS = {
  docket: ['Docket No', 'Docket Number', 'Docket', 'Docket #', 'Docket No.', 'Load Docket'],
  date: ['Docket Date', 'Load Date', 'Date', 'Date Loaded', 'Cart Date'],
  harvest: ['Harvest', 'Operation', 'Setting', 'Block', 'Crop', 'Harvest Area'],
  product: ['Product', 'Grade', 'Log Grade', 'Product Code', 'Sort'],
  customer: ['Customer', 'Destination', 'Buyer', 'Mill', 'Delivered To'],
  truck: ['Truck', 'Truck Rego', 'Truck No', 'Vehicle', 'Rego'],
  carrier: ['Carrier', 'Transport', 'Cartage Contractor', 'Haulier', 'Transporter'],
  gross: ['Gross', 'Gross Weight', 'Gross Kg', 'Gross (kg)'],
  tare: ['Tare', 'Tare Weight', 'Tare Kg', 'Tare (kg)'],
  net: ['Nett', 'Net', 'Net Tonnes', 'Nett Tonnes', 'Tonnes', 'Net Weight (t)'],
  mill_tonnes: ['Mill Tonnes', 'Received Tonnes', 'Weighbridge Tonnes', 'Tonnes', 'Nett', 'Net'],
  value: ['Value', 'Amount', 'Nett Value', 'Payment', 'Extended Value', 'Value Excl GST'],
  levy: ['Levy', 'FGL Levy', 'Forest Growers Levy', 'Levy Deducted'],
  received: ['Received Date', 'Date Received', 'Delivery Date', 'Date'],
  statement: ['Statement', 'Statement No', 'Statement Ref', 'Remittance'],
};

async function importer(db, vendor, f) {
  if (!['pslog', 'mill'].includes(vendor)) throw Error('Supported imports: pslog (dockets) and mill (a buyer statement)');
  const file = need(f.file, 'Specify --file=report.csv');
  if (!String(file).toLowerCase().endsWith('.csv')) throw Error('Save the report from Excel as CSV first. Read docs/replace-pslog.md.');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  if (!rows.length) throw Error('CSV has no data rows');
  const get = (row, col) => pick(row, ...COLUMNS[col]).trim();
  const counts = { rows: rows.length, created: 0, updated: 0 };
  const findOrMake = async (kind, value, insertSql, params, tally) => {
    const hit = await db.query(`select id from ${kind} where lower(${label[kind]})=lower($1)`, [value]);
    if (hit.length) return hit[0].id;
    counts[tally] = (counts[tally] || 0) + 1;
    return (await db.query(insertSql, params))[0].id;
  };
  await db.exec('BEGIN');
  try {
    if (vendor === 'pslog') {
      const fixed = f.harvest ? await resolve(db, 'operations', f.harvest) : null;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const number = need(get(row, 'docket'), `${where}: Docket No required`);
        const opCode = fixed?.code || need(get(row, 'harvest'), `${where}: no Harvest column; pass --harvest=<code>`);
        const op = (await db.query('select id from operations where lower(code)=lower($1)', [opCode]))[0];
        if (!op) throw Error(`${where}: harvest "${opCode}" is not set up. Add it first: add operations --code=${opCode} --forest_id=...`);
        const productId = await findOrMake('products', need(get(row, 'product'), `${where}: Product required`), `insert into products (code,name) values ($1,$1) returning id`, [get(row, 'product')], 'products_added');
        const customerId = await findOrMake('customers', need(get(row, 'customer'), `${where}: Customer or Destination required`), `insert into customers (name) values ($1) returning id`, [get(row, 'customer')], 'customers_added');
        let truckId = null;
        if (get(row, 'truck')) {
          const carrierName = get(row, 'carrier') || 'Unknown carrier';
          const carrierId = await findOrMake('contractors', carrierName, `insert into contractors (name,kind) values ($1,'cartage') returning id`, [carrierName], 'carriers_added');
          truckId = await findOrMake('trucks', get(row, 'truck'), `insert into trucks (carrier_id,rego) values ($1,$2) returning id`, [carrierId, get(row, 'truck')], 'trucks_added');
        }
        const gross = num(get(row, 'gross'), `${where} Gross`), tare = num(get(row, 'tare'), `${where} Tare`);
        let net = num(get(row, 'net'), `${where} Nett`);
        if (gross !== null && tare !== null) net = null;
        if (net === null && (gross === null || tare === null)) throw Error(`${where}: needs Gross and Tare in kg, or Nett tonnes`);
        const existing = (await db.query('select id from dockets where lower(number)=lower($1)', [number]))[0];
        await db.query(`insert into dockets (number,operation_id,product_id,customer_id,truck_id,loaded_on,gross_kg,tare_kg,net_tonnes,external_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$1)
          on conflict (number) do update set operation_id=excluded.operation_id,product_id=excluded.product_id,customer_id=excluded.customer_id,truck_id=coalesce(excluded.truck_id,dockets.truck_id),
          loaded_on=excluded.loaded_on,gross_kg=excluded.gross_kg,tare_kg=excluded.tare_kg,net_tonnes=excluded.net_tonnes`,
          [number, op.id, productId, customerId, truckId, need(toDate(get(row, 'date'), where), `${where}: Docket Date required`), gross, tare, net]);
        counts[existing ? 'updated' : 'created']++;
      }
    } else {
      const c = await resolve(db, 'customers', need(f.customer, 'Import a mill statement with --customer=<buyer>'));
      counts.unmatched = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i], where = `Row ${i + 2}`;
        const number = need(get(row, 'docket'), `${where}: Docket No required`);
        const d = (await db.query('select id,number,customer_id from dockets where lower(number)=lower($1)', [number]))[0];
        if (d && d.customer_id !== c.id) throw Error(`${where}: docket ${number} went to another buyer, not ${c.name}`);
        if (!d) counts.unmatched++;
        const existing = (await db.query('select id from mill_lines where customer_id=$1 and lower(docket_number)=lower($2)', [c.id, number]))[0];
        await db.query(`insert into mill_lines (customer_id,docket_number,docket_id,received_on,tonnes,value_cents,levy_cents,statement_ref) values ($1,$2,$3,$4,$5,$6,$7,$8)
          on conflict (customer_id,docket_number) do update set docket_id=coalesce(excluded.docket_id,mill_lines.docket_id),received_on=excluded.received_on,tonnes=excluded.tonnes,
          value_cents=coalesce(excluded.value_cents,mill_lines.value_cents),levy_cents=coalesce(excluded.levy_cents,mill_lines.levy_cents),statement_ref=coalesce(excluded.statement_ref,mill_lines.statement_ref)`,
          [c.id, d?.number || number, d?.id || null, need(toDate(get(row, 'received'), where), `${where}: Received Date required`), need(num(get(row, 'mill_tonnes'), `${where} Tonnes`), `${where}: Tonnes required`),
            cents(get(row, 'value')), cents(get(row, 'levy')), get(row, 'statement') || f.ref || null]);
        counts[existing ? 'updated' : 'created']++;
      }
    }
    await db.exec(f['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
  return { import: vendor, ...counts, dry_run: Boolean(f['dry-run']) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  const args = process.argv.slice(2), json = args.includes('--json');
  try { db = await getDb(); const out = await execute(db, args); console.log(json ? JSON.stringify(out, null, 2) : human(out)); }
  catch (e) { if (json) console.log(JSON.stringify({ error: e.message, ...(e.matches ? { matches: e.matches } : {}) })); else console.error(e.message); process.exitCode = 1; }
  finally { await db?.close(); }
}
