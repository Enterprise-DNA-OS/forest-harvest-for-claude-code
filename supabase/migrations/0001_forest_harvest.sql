-- Forest Harvest for Claude Code: the harvest and log sales records of a forest manager.
-- Owners and their forests, harvests and their council notices, every load's docket,
-- what the mill says it received, the price sheet and contract rates, sales invoices
-- (yours and the buyer-created ones), owner returns, contractor pay and the growers' levy.
-- Plain Postgres. Runs on any Postgres and on the embedded PGlite. No extensions.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Business-wide settings the checks read. One row.
create table settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Your forest management business',
  gst_number text,
  gst_rate numeric(5,4) not null default 0.15,
  levy_cents_per_tonne numeric(8,2) not null default 33,      -- Commodity Levies (Harvested Wood Material) Order 2025, first levy year
  default_max_gross_kg int not null default 44000,            -- Vehicle Dimensions and Mass Rule 2016: general access without a permit
  notice_min_working_days int not null default 20,            -- NES-CF reg 64(2)(a)
  notice_max_working_days int not null default 60,            -- NES-CF reg 64(2)(a)
  salvage_notice_days int not null default 2,                 -- NES-CF reg 64(2)(b)
  plan_min_working_days int not null default 20,              -- NES-CF reg 66(2)(c)
  replant_notice_min_working_days int not null default 20,    -- NES-CF reg 78A(2)(a)
  replant_notice_max_months int not null default 8,           -- NES-CF reg 78A(2)(a)
  mill_match_days int not null default 7,                     -- a docket with no mill line after this many days needs chasing
  tonnage_tolerance_pct numeric(5,2) not null default 2,      -- mill tonnes against docket tonnes
  price_tolerance_pct numeric(5,2) not null default 1,        -- mill value against your price sheet
  invoice_after_days int not null default 14,                 -- received loads older than this should be invoiced
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Days that are not working days, beyond weekends and 20 December to 10 January (RMA 1991 s 2).
create table holidays (
  on_date date primary key,
  name text not null
);

create table owners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  gst_number text,
  mgmt_fee_cents_per_tonne int not null default 0,            -- your management fee, per tonne
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table forests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id),
  name text not null unique,
  region text,
  regional_council text,
  territorial_authority text,
  area_ha numeric(10,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logging crews, cartage firms and loaders you pay.
create table contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null check (kind in ('logging','cartage','roading','other')),
  contact_name text,
  email text,
  gst_number text,
  bcti_agreement_on date,           -- the day they agreed you create their tax invoices (buyer-created taxable supply information)
  bcti_reason text,                 -- recorded reason, when it is not your normal terms of business
  payment_terms_days int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mills, exporters and log buyers.
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'domestic mill' check (kind in ('domestic mill','exporter','pulp mill','other')),
  contact_name text,
  email text,
  gst_number text,
  payment_terms_days int not null default 30,
  buyer_created boolean not null default false,  -- the buyer issues the taxable supply information for your loads
  bcti_agreement_on date,
  bcti_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- A, K, KI, P1, S1, S2, L1, PULP: your own grade codes
  name text not null,
  market text not null default 'domestic' check (market in ('export','domestic','pulp')),
  created_at timestamptz not null default now()
);

create table trucks (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references contractors(id),
  rego text not null unique,
  fleet_no text,
  max_gross_kg int,                 -- the mass the truck may run at: general access, or its permit (50MAX, HPMV). Null = settings default
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One harvest: an operation in a forest, with a crew, a contract rate and its council notices.
create table operations (
  id uuid primary key default gen_random_uuid(),
  forest_id uuid not null references forests(id),
  code text not null unique,
  name text,
  crew_id uuid references contractors(id),
  status text not null default 'planned' check (status in ('planned','active','finished','replanted','cancelled')),
  salvage boolean not null default false,
  est_tonnes numeric(12,1),
  area_ha numeric(10,1),
  logging_rate_cents int not null default 0,       -- per tonne, felling to loading
  planned_start date,
  planned_end date,
  started_on date,
  finished_on date,
  notice_given_on date,            -- written notice of harvesting to the regional council and territorial authority
  plan_in_place_on date,           -- harvesting plan completed
  replant_planned_on date,
  replant_notice_on date,
  replanted_on date,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What each buyer pays per tonne, by grade, from a date. The latest price on or before the load date applies.
create table sale_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  product_id uuid not null references products(id),
  from_on date not null,
  price_cents int not null check (price_cents >= 0),
  unique (customer_id, product_id, from_on)
);

-- What each carrier charges per tonne to each destination, from a date.
create table cartage_rates (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references contractors(id),
  customer_id uuid not null references customers(id),
  from_on date not null,
  rate_cents int not null check (rate_cents >= 0),
  unique (carrier_id, customer_id, from_on)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  number text not null unique,     -- yours, or the buyer's statement reference when the buyer created it
  buyer_created boolean not null default false,
  issued_on date not null,
  due_on date not null,
  amount_cents bigint not null,    -- excluding GST
  gst_cents bigint not null default 0,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table owner_returns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id),
  number text not null unique,
  period_start date not null,
  period_end date not null,
  issued_on date not null,
  tonnes numeric(12,3) not null,
  sales_cents bigint not null,
  costs_cents bigint not null,
  net_cents bigint not null,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contractor_payments (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id),
  number text not null unique,
  kind text not null check (kind in ('logging','cartage')),
  buyer_created boolean not null default false,   -- you issued their tax invoice under an agreement
  period_end date not null,
  issued_on date not null,
  tonnes numeric(12,3) not null,
  amount_cents bigint not null,
  gst_cents bigint not null default 0,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One load of logs: the delivery docket.
create table dockets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  operation_id uuid not null references operations(id),
  product_id uuid not null references products(id),
  customer_id uuid not null references customers(id),
  truck_id uuid references trucks(id),
  loaded_on date not null,
  gross_kg int,
  tare_kg int,
  net_tonnes numeric(10,3),        -- the weighbridge net; worked out from gross and tare when not given
  invoice_id uuid references invoices(id),
  owner_return_id uuid references owner_returns(id),
  logging_pay_id uuid references contractor_payments(id),
  cartage_pay_id uuid references contractor_payments(id),
  note text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_tonnes is not null or (gross_kg is not null and tare_kg is not null))
);

-- What the mill or exporter says it received: one line per docket on their statement.
create table mill_lines (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  docket_number text not null,
  docket_id uuid references dockets(id),
  received_on date not null,
  tonnes numeric(10,3) not null,
  value_cents bigint,              -- what they will pay for the load, excluding GST
  levy_cents bigint,               -- growers' levy they deducted, if any
  statement_ref text,
  created_at timestamptz not null default now(),
  unique (customer_id, docket_number)
);
create unique index mill_lines_docket on mill_lines(docket_id) where docket_id is not null;

-- Levy the owner paid directly for loads the buyer did not deduct it from.
create table levy_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id),
  month date not null,             -- first day of the month
  tonnes numeric(12,3) not null,
  amount_cents bigint not null,
  paid_on date not null,
  unique (owner_id, month)
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid references operations(id),
  owner_id uuid references owners(id),
  title text not null default 'Note',
  body text not null,
  created_at timestamptz not null default now()
);

create trigger owners_touch before update on owners for each row execute function touch_updated_at();
create trigger forests_touch before update on forests for each row execute function touch_updated_at();
create trigger contractors_touch before update on contractors for each row execute function touch_updated_at();
create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create trigger trucks_touch before update on trucks for each row execute function touch_updated_at();
create trigger operations_touch before update on operations for each row execute function touch_updated_at();
create trigger invoices_touch before update on invoices for each row execute function touch_updated_at();
create trigger owner_returns_touch before update on owner_returns for each row execute function touch_updated_at();
create trigger contractor_payments_touch before update on contractor_payments for each row execute function touch_updated_at();
create trigger dockets_touch before update on dockets for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- A working day: not a weekend, not 20 December to 10 January, not a listed holiday.
create or replace function is_working_day(d date) returns boolean language sql stable as $$
  select extract(isodow from d) < 6
    and to_char(d, 'MMDD') not between '0101' and '0110'
    and to_char(d, 'MMDD') < '1220'
    and not exists (select 1 from holidays h where h.on_date = d)
$$;

-- Working days strictly between two dates.
create or replace function working_days_between(a date, b date) returns int language sql stable as $$
  select count(*)::int from generate_series(a + 1, b - 1, interval '1 day') g(d) where is_working_day(g.d::date)
$$;

-- Counting back from the day before start: c(y) is the working days from y to the day before start.
-- Working days strictly between x and start is c(x + 1).
-- notice_by: the latest day you can give notice and still leave n working days before the start.
create or replace function notice_by(start_on date, n int) returns date language sql stable as $$
  select (max(y) - 1)::date from (
    select g.d::date as y, sum(case when is_working_day(g.d::date) then 1 else 0 end) over (order by g.d desc) as c
    from generate_series(start_on - 1, start_on - 400, interval '-1 day') g(d)
  ) t where c >= n
$$;

-- notice_from: the earliest day notice counts, leaving no more than n working days before the start.
create or replace function notice_from(start_on date, n int) returns date language sql stable as $$
  select (min(y) - 1)::date from (
    select g.d::date as y, sum(case when is_working_day(g.d::date) then 1 else 0 end) over (order by g.d desc) as c
    from generate_series(start_on - 1, start_on - 400, interval '-1 day') g(d)
  ) t where c <= n
$$;

-- Every load, valued. Tonnes are the mill's where it has reported them, otherwise the weighbridge.
create view v_loads as
select d.id, d.number as docket, d.loaded_on, o.id as operation_id, o.code as harvest, f.name as forest, f.owner_id, ow.name as owner,
  p.code as product, p.market, c.id as customer_id, c.name as customer, c.buyer_created, t.rego as truck, t.carrier_id, ca.name as carrier,
  o.crew_id, cr.name as crew, d.gross_kg, coalesce(t.max_gross_kg, s.default_max_gross_kg) as max_gross_kg,
  coalesce(d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0)::numeric(10,3) as docket_tonnes,
  m.tonnes as mill_tonnes, m.received_on, m.value_cents as mill_value_cents, m.levy_cents as levy_deducted_cents,
  coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0)::numeric(10,3) as tonnes,
  pr.price_cents,
  round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * pr.price_cents)::bigint as expected_cents,
  coalesce(m.value_cents, round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * pr.price_cents))::bigint as sale_cents,
  round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * o.logging_rate_cents)::bigint as logging_cents,
  round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * coalesce(cr8.rate_cents, 0))::bigint as cartage_cents,
  round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * s.levy_cents_per_tonne)::bigint as levy_cents,
  round(coalesce(m.tonnes, d.net_tonnes, (d.gross_kg - d.tare_kg) / 1000.0) * ow.mgmt_fee_cents_per_tonne)::bigint as mgmt_cents,
  cr8.rate_cents as cartage_rate_cents,
  case when m.id is not null then 'received' else 'in transit' end as state,
  d.invoice_id, d.owner_return_id, d.logging_pay_id, d.cartage_pay_id
from dockets d
join operations o on o.id = d.operation_id
join forests f on f.id = o.forest_id
join owners ow on ow.id = f.owner_id
join products p on p.id = d.product_id
join customers c on c.id = d.customer_id
cross join settings s
left join trucks t on t.id = d.truck_id
left join contractors ca on ca.id = t.carrier_id
left join contractors cr on cr.id = o.crew_id
left join mill_lines m on m.docket_id = d.id
left join lateral (select price_cents from sale_prices sp where sp.customer_id = d.customer_id and sp.product_id = d.product_id and sp.from_on <= d.loaded_on order by sp.from_on desc limit 1) pr on true
left join lateral (select rate_cents from cartage_rates r where r.carrier_id = t.carrier_id and r.customer_id = d.customer_id and r.from_on <= d.loaded_on order by r.from_on desc limit 1) cr8 on true;

-- What the owner gets from each load once the buyer pays: sale less logging, cartage, levy and your fee.
create view v_owner_lines as
select l.*, l.sale_cents - l.logging_cents - l.cartage_cents - l.levy_cents - l.mgmt_cents as owner_net_cents
from v_loads l;

-- Each harvest: tonnes to date against the estimate, pace and money.
create view v_harvests as
select o.id as operation_id, o.code as harvest, f.name as forest, ow.name as owner, cr.name as crew, o.status, o.salvage,
  o.est_tonnes, coalesce(sum(l.tonnes), 0)::numeric(12,1) as tonnes, count(l.id)::int as loads,
  count(distinct l.loaded_on)::int as days_loading,
  round(coalesce(sum(l.tonnes), 0) / nullif(count(distinct l.loaded_on), 0), 1) as tonnes_per_day,
  case when o.status in ('finished','replanted','cancelled') then 0 else greatest(o.est_tonnes - coalesce(sum(l.tonnes), 0), 0) end::numeric(12,1) as tonnes_left,
  round(coalesce(sum(l.sale_cents), 0) / 100.0) as sales,
  round(coalesce(sum(l.sale_cents - l.logging_cents - l.cartage_cents - l.levy_cents - l.mgmt_cents), 0) / 100.0) as owner_net,
  round(sum(l.sale_cents - l.logging_cents - l.cartage_cents - l.levy_cents - l.mgmt_cents) / nullif(sum(l.tonnes), 0) / 100.0, 2) as owner_net_per_tonne,
  o.planned_start, o.started_on, o.finished_on
from operations o
join forests f on f.id = o.forest_id
join owners ow on ow.id = f.owner_id
left join contractors cr on cr.id = o.crew_id
left join v_loads l on l.operation_id = o.id
group by o.id, f.name, ow.name, cr.name;

-- Council notices for each harvest and replanting: the window, what was given, and its state.
create view v_notices as
select o.id as operation_id, o.code as harvest, f.name as forest, f.regional_council, f.territorial_authority, 'harvest' as kind,
  o.planned_start as starts_on,
  case when o.salvage then o.planned_start - s.salvage_notice_days else notice_from(o.planned_start, s.notice_max_working_days) end as window_opens,
  case when o.salvage then o.planned_start - s.salvage_notice_days else notice_by(o.planned_start, s.notice_min_working_days) end as give_by,
  o.notice_given_on as given_on,
  case when o.salvage then null else notice_by(o.planned_start, s.plan_min_working_days) end as plan_by,
  o.plan_in_place_on
from operations o join forests f on f.id = o.forest_id cross join settings s
where o.planned_start is not null and o.status in ('planned','active')
union all
select o.id, o.code, f.name, f.regional_council, f.territorial_authority, 'replant',
  o.replant_planned_on,
  (o.replant_planned_on - make_interval(months => s.replant_notice_max_months))::date,
  notice_by(o.replant_planned_on, s.replant_notice_min_working_days),
  o.replant_notice_on, null, null
from operations o join forests f on f.id = o.forest_id cross join settings s
where o.replant_planned_on is not null and o.replanted_on is null;

-- Money owed to you: received loads not invoiced, and invoices not yet paid.
create view v_receivables as
select 'not invoiced' as state, l.customer, 'Docket ' || l.docket || ' ' || l.product as description, l.sale_cents as amount_cents,
  l.received_on as since, (current_date - l.received_on) as days, l.customer_id
from v_loads l where l.state = 'received' and l.invoice_id is null
union all
select case when i.due_on < current_date then 'overdue' else 'open' end, c.name, 'Invoice ' || i.number, i.amount_cents + i.gst_cents,
  i.due_on, (current_date - i.due_on), c.id
from invoices i join customers c on c.id = i.customer_id where i.paid_on is null;

-- Mill statements against your dockets.
create view v_reconcile as
select 'NO MILL LINE' as issue, l.customer, l.docket, l.loaded_on as on_date, l.docket_tonnes as docket_tonnes, null::numeric as mill_tonnes,
  'Loaded ' || (current_date - l.loaded_on) || ' days ago, not on any statement from ' || l.customer as detail
from v_loads l cross join settings s where l.state = 'in transit' and l.loaded_on < current_date - s.mill_match_days
union all
select 'NO DOCKET', c.name, m.docket_number, m.received_on, null, m.tonnes,
  'On ' || c.name || '''s statement' || coalesce(' ' || m.statement_ref, '') || ' with no matching docket'
from mill_lines m join customers c on c.id = m.customer_id where m.docket_id is null
union all
select 'TONNES DIFFER', l.customer, l.docket, l.received_on, l.docket_tonnes, l.mill_tonnes,
  'Mill ' || l.mill_tonnes || ' t against docket ' || l.docket_tonnes || ' t (' || round(100 * (l.mill_tonnes - l.docket_tonnes) / nullif(l.docket_tonnes, 0), 1) || '%)'
from v_loads l cross join settings s where l.mill_tonnes is not null and abs(l.mill_tonnes - l.docket_tonnes) > l.docket_tonnes * s.tonnage_tolerance_pct / 100
union all
select 'PRICE DIFFERS', l.customer, l.docket, l.received_on, l.docket_tonnes, l.mill_tonnes,
  'Mill value ' || round(l.mill_value_cents / 100.0, 2) || ' against price sheet ' || round(l.expected_cents / 100.0, 2) || ' (' || l.product || ' at ' || round(l.price_cents / 100.0, 2) || '/t)'
from v_loads l cross join settings s where l.mill_value_cents is not null and l.expected_cents is not null and abs(l.mill_value_cents - l.expected_cents) > l.expected_cents * s.price_tolerance_pct / 100
union all
select 'NO PRICE', l.customer, l.docket, l.loaded_on, l.docket_tonnes, l.mill_tonnes, 'No ' || l.product || ' price for ' || l.customer || ' on ' || l.loaded_on
from v_loads l where l.price_cents is null;

-- Growers' levy by owner and month: what is due, what buyers deducted, what the owner paid.
create view v_levy as
select v.*, (select lp.paid_on from levy_payments lp where lp.owner_id = v.owner_id and lp.month = v.month) as owner_paid_on
from (
  select l.owner_id, l.owner, date_trunc('month', l.loaded_on)::date as month, sum(l.tonnes)::numeric(12,3) as tonnes,
    sum(l.levy_cents)::bigint as levy_due_cents,
    coalesce(sum(l.levy_deducted_cents), 0)::bigint as deducted_by_buyers_cents,
    coalesce(sum(l.tonnes) filter (where l.levy_deducted_cents is null), 0)::numeric(12,3) as undeducted_tonnes,
    coalesce(sum(l.levy_cents) filter (where l.levy_deducted_cents is null), 0)::bigint as owner_to_pay_cents
  from v_loads l
  group by l.owner_id, l.owner, date_trunc('month', l.loaded_on)
) v;

-- The rules in docs/compliance.md, checked against the records.
create view v_compliance as
select 'HARVEST-NOTICE' as rule, n.harvest, n.harvest || ' (' || n.forest || ')' as record,
  case when n.given_on is null then 'No written notice of harvesting recorded; give it by ' || n.give_by
       when n.given_on > n.give_by then 'Notice given ' || n.given_on || ', after ' || n.give_by || ' (' || working_days_between(n.given_on, n.starts_on) || ' working days before the start)'
       else 'Notice given ' || n.given_on || ', before ' || n.window_opens || ': more than the maximum working days ahead' end as finding,
  n.give_by as due_date, 'NES-CF reg 64(2)' as source
from v_notices n
where n.kind = 'harvest' and (n.given_on is null and n.give_by <= current_date + 14 or n.given_on > n.give_by or n.given_on < n.window_opens)
union all
select 'HARVEST-PLAN', n.harvest, n.harvest || ' (' || n.forest || ')',
  case when n.plan_in_place_on is null then 'No harvesting plan recorded; it must be in place by ' || coalesce(n.plan_by, n.starts_on)
       else 'Harvesting plan in place ' || n.plan_in_place_on || ', after ' || coalesce(n.plan_by, n.starts_on) end,
  coalesce(n.plan_by, n.starts_on), 'NES-CF reg 66(2)(c) and (d)'
from v_notices n
where n.kind = 'harvest' and (n.plan_in_place_on is null and coalesce(n.plan_by, n.starts_on) <= current_date + 14 or n.plan_in_place_on > coalesce(n.plan_by, n.starts_on))
union all
select 'REPLANT-NOTICE', n.harvest, n.harvest || ' replanting (' || n.forest || ')',
  case when n.given_on is null then 'No written notice of replanting recorded; give it by ' || n.give_by
       when n.given_on > n.give_by then 'Replanting notice given ' || n.given_on || ', after ' || n.give_by
       else 'Replanting notice given ' || n.given_on || ', more than the maximum months before replanting' end,
  n.give_by, 'NES-CF reg 78A(2)(a)'
from v_notices n
where n.kind = 'replant' and (n.given_on is null and n.give_by <= current_date + 30 or n.given_on > n.give_by or n.given_on < n.window_opens)
union all
select 'BCTI-AGREEMENT', null, c.name || ' (buyer)', 'Buyer creates your sales invoices but no agreement date is recorded', null, 'Inland Revenue: buyer-created taxable supply information'
from customers c where c.buyer_created and c.bcti_agreement_on is null and exists (select 1 from dockets d where d.customer_id = c.id)
union all
select 'BCTI-AGREEMENT', null, ct.name || ' (contractor)', 'You issued their tax invoice on ' || cp.issued_on || ' (' || cp.number || ') with no agreement recorded', cp.issued_on, 'Inland Revenue: buyer-created taxable supply information'
from contractor_payments cp join contractors ct on ct.id = cp.contractor_id where cp.buyer_created and (ct.bcti_agreement_on is null or ct.bcti_agreement_on > cp.issued_on)
union all
select 'BCTI-GST-NUMBERS', null, x.name, x.what, null, 'Inland Revenue: buyer-created taxable supply information must show both GST numbers'
from (
  select ct.name || ' (contractor)' as name, 'You create their tax invoices but their GST number is not recorded' as what from contractors ct
   where ct.bcti_agreement_on is not null and coalesce(ct.gst_number, '') = ''
  union all
  select 'Your business', 'You create contractors'' tax invoices but your own GST number is not in settings' from settings s
   where coalesce(s.gst_number, '') = '' and exists (select 1 from contractors ct where ct.bcti_agreement_on is not null)
  union all
  select ow.name || ' (owner)', 'Their loads go to a buyer that creates the tax invoice, but the owner''s GST number is not recorded' from owners ow
   where coalesce(ow.gst_number, '') = '' and exists (select 1 from v_loads l where l.owner_id = ow.id and l.buyer_created)
) x
union all
select 'LEVY-UNACCOUNTED', null, v.owner || ' ' || to_char(v.month, 'YYYY-MM'),
  v.undeducted_tonnes || ' t with no levy deducted by the buyer and no owner payment recorded (' || round(v.owner_to_pay_cents / 100.0, 2) || ')',
  (v.month + interval '2 months' - interval '1 day')::date, 'Commodity Levies (Harvested Wood Material) Order 2025'
from v_levy v where v.month < date_trunc('month', current_date) and v.undeducted_tonnes > 0 and v.owner_paid_on is null
union all
select 'OVERWEIGHT-LOAD', l.harvest, 'Docket ' || l.docket || ' (' || coalesce(l.truck, 'no truck') || ')',
  'Gross ' || l.gross_kg || ' kg against ' || l.max_gross_kg || ' kg allowed for this truck', l.loaded_on, 'Land Transport Rule: Vehicle Dimensions and Mass 2016'
from v_loads l where l.gross_kg > l.max_gross_kg;

-- Everything that needs someone: notices first, then the mill, money and owners.
create view v_attention as
select 'NOTICE DUE' as item, n.harvest, n.harvest || ' ' || n.kind as record, coalesce(n.regional_council, 'Council') as owner, n.give_by as due_date,
  'Give written notice of ' || case when n.kind = 'harvest' then 'harvesting' else 'replanting' end || ' by ' || n.give_by || ' for a start on ' || n.starts_on as detail
from v_notices n where n.given_on is null and n.give_by <= current_date + 21
union all
select 'PLAN DUE', n.harvest, n.harvest || ' harvesting plan', 'Harvest planner', coalesce(n.plan_by, n.starts_on), 'Harvesting plan must be in place by ' || coalesce(n.plan_by, n.starts_on)
from v_notices n where n.kind = 'harvest' and n.plan_in_place_on is null and coalesce(n.plan_by, n.starts_on) <= current_date + 21
union all
select 'MILL ' || r.issue, null, r.docket, r.customer, r.on_date, r.detail from v_reconcile r
union all
select 'OVERWEIGHT', l.harvest, 'Docket ' || l.docket, l.carrier, l.loaded_on, 'Gross ' || l.gross_kg || ' kg, allowed ' || l.max_gross_kg || ' kg'
from v_loads l where l.gross_kg > l.max_gross_kg
union all
select 'NOT INVOICED', null, r.customer, 'Accounts', min(r.since), count(*) || ' received load(s) worth ' || round(sum(r.amount_cents) / 100.0) || ', oldest ' || max(r.days) || ' days'
from v_receivables r join customers c on c.id = r.customer_id cross join settings s
where r.state = 'not invoiced' and not c.buyer_created group by r.customer, s.invoice_after_days having max(r.days) > s.invoice_after_days
union all
select 'STATEMENT DUE', null, r.customer, r.customer, min(r.since), count(*) || ' received load(s) worth ' || round(sum(r.amount_cents) / 100.0) || ' with no buyer-created statement recorded'
from v_receivables r join customers c on c.id = r.customer_id cross join settings s
where r.state = 'not invoiced' and c.buyer_created group by r.customer, s.invoice_after_days having max(r.days) > s.invoice_after_days + 14
union all
select 'INVOICE OVERDUE', null, r.description, r.customer, r.since, round(r.amount_cents / 100.0) || ' incl GST, ' || r.days || ' days past due'
from v_receivables r where r.state = 'overdue'
union all
select 'OWNER RETURN DUE', null, l.owner || ' ' || to_char(date_trunc('month', l.loaded_on), 'YYYY-MM'), 'Accounts', (date_trunc('month', l.loaded_on) + interval '1 month')::date,
  count(*) || ' received load(s), ' || sum(l.tonnes) || ' t, not on an owner return'
from v_loads l where l.state = 'received' and l.owner_return_id is null and l.loaded_on < date_trunc('month', current_date)
group by l.owner, date_trunc('month', l.loaded_on)
union all
select 'CONTRACTOR PAY DUE', null, x.contractor, 'Accounts', min(x.loaded_on), count(*) || ' load(s), ' || sum(x.tonnes) || ' t of ' || x.kind || ' not yet paid'
from (select l.crew as contractor, 'logging' as kind, l.loaded_on, l.tonnes from v_loads l where l.logging_pay_id is null and l.crew is not null and l.loaded_on < date_trunc('month', current_date)
      union all select l.carrier, 'cartage', l.loaded_on, l.tonnes from v_loads l where l.cartage_pay_id is null and l.carrier is not null and l.loaded_on < date_trunc('month', current_date)) x
group by x.contractor, x.kind
union all
select 'REPLANT NOT PLANNED', o.code, o.code || ' (' || f.name || ')', 'Forest manager', o.finished_on, 'Harvest finished ' || o.finished_on || ' with no replanting date'
from operations o join forests f on f.id = o.forest_id where o.status = 'finished' and o.replant_planned_on is null;
