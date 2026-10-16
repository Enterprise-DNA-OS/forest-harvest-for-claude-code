-- Demo data: one fictional forest management business, three owners, three buyers, four harvests.
-- Dates are relative to today, so there is always a notice due, a docket missing at the mill,
-- an invoice overdue and an owner return to write. Idempotent: fixed ids and docket numbers,
-- on conflict do nothing. Every name, number and record here is invented.

update settings set business_name = 'Kahikatea Forest Management (demo)', gst_number = '123-456-780' where id = 1;

-- New Zealand public holidays that fall on working days (RMA 1991 s 2). Add your years as they come.
insert into holidays (on_date, name) values
  ('2026-01-01', 'New Year''s Day'), ('2026-01-02', 'Day after New Year''s Day'), ('2026-02-06', 'Waitangi Day'),
  ('2026-04-03', 'Good Friday'), ('2026-04-06', 'Easter Monday'), ('2026-04-27', 'Anzac Day (Monday)'),
  ('2026-06-01', 'King''s Birthday'), ('2026-07-10', 'Matariki'), ('2026-10-26', 'Labour Day'),
  ('2027-01-01', 'New Year''s Day'), ('2027-01-04', 'Day after New Year''s Day (Monday)'), ('2027-02-08', 'Waitangi Day (Monday)'),
  ('2027-03-26', 'Good Friday'), ('2027-03-29', 'Easter Monday'), ('2027-04-26', 'Anzac Day (Monday)'),
  ('2027-06-07', 'King''s Birthday'), ('2027-06-25', 'Matariki'), ('2027-10-25', 'Labour Day')
on conflict (on_date) do nothing;

insert into owners (id, name, contact_name, email, phone, gst_number, mgmt_fee_cents_per_tonne) values
  ('10000000-0000-4000-8000-000000000001', 'Te Awa Whanau Trust', 'Hemi Walker', 'trustees@teawa.example', '027 555 0101', '111-222-333', 400),
  ('10000000-0000-4000-8000-000000000002', 'Rangiwahia Partnership', 'Sue Grant', 'sue@rangiwahia.example', '027 555 0102', null, 450),
  ('10000000-0000-4000-8000-000000000003', 'McKenzie Family Woodlot', 'Ian McKenzie', 'ian@mckenzie.example', '027 555 0103', '222-333-444', 450)
on conflict (id) do nothing;

insert into forests (id, owner_id, name, region, regional_council, territorial_authority, area_ha) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Te Awa Forest', 'Manawatu-Whanganui', 'Horizons Regional Council', 'Tararua District Council', 640),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Rangiwahia Woodlot', 'Manawatu-Whanganui', 'Horizons Regional Council', 'Manawatu District Council', 85),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'McKenzie Block', 'Waikato', 'Waikato Regional Council', 'Otorohanga District Council', 42)
on conflict (id) do nothing;

insert into contractors (id, name, kind, contact_name, email, gst_number, bcti_agreement_on, payment_terms_days) values
  ('30000000-0000-4000-8000-000000000001', 'Ridgeline Logging', 'logging', 'Wiremu Tane', 'office@ridgeline.example', '98-765-432', current_date - 400, 20),
  ('30000000-0000-4000-8000-000000000002', 'Hauraki Haulage', 'cartage', 'Dean Morris', 'accounts@hauraki.example', null, current_date - 300, 20),
  ('30000000-0000-4000-8000-000000000003', 'Tui Transport', 'cartage', 'Lisa Tui', 'lisa@tuitransport.example', '87-654-321', null, 20),
  ('30000000-0000-4000-8000-000000000004', 'Kauri Cutters', 'logging', 'Pita Rewi', 'pita@kauricutters.example', '76-543-210', current_date - 500, 20)
on conflict (id) do nothing;

insert into customers (id, name, kind, contact_name, email, gst_number, payment_terms_days, buyer_created, bcti_agreement_on) values
  ('40000000-0000-4000-8000-000000000001', 'Pacific Log Exports', 'exporter', 'Grace Liu', 'logs@pacificlog.example', '55-111-222', 20, true, current_date - 600),
  ('40000000-0000-4000-8000-000000000002', 'Manawatu Sawmills', 'domestic mill', 'Tony Burke', 'payables@mwsawmills.example', '66-222-333', 20, false, null),
  ('40000000-0000-4000-8000-000000000003', 'Central Pulp and Paper', 'pulp mill', 'Raj Patel', 'fibre@centralpulp.example', '77-333-444', 20, true, null)
on conflict (id) do nothing;

insert into products (id, code, name, market) values
  ('50000000-0000-4000-8000-000000000001', 'A', 'A grade export sawlog', 'export'),
  ('50000000-0000-4000-8000-000000000002', 'K', 'K grade export sawlog', 'export'),
  ('50000000-0000-4000-8000-000000000003', 'KI', 'KI grade export', 'export'),
  ('50000000-0000-4000-8000-000000000004', 'P1', 'Pruned sawlog', 'domestic'),
  ('50000000-0000-4000-8000-000000000005', 'S1', 'Structural sawlog 1', 'domestic'),
  ('50000000-0000-4000-8000-000000000006', 'S2', 'Structural sawlog 2', 'domestic'),
  ('50000000-0000-4000-8000-000000000007', 'PULP', 'Pulp log', 'pulp')
on conflict (id) do nothing;

insert into trucks (id, carrier_id, rego, fleet_no, max_gross_kg) values
  ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'HHL101', 'H1', 50000),
  ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'HHL102', 'H2', null),
  ('60000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'TUI7', 'T7', 50000),
  ('60000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', 'TUI9', 'T9', null)
on conflict (id) do nothing;

-- Price sheets (cents per tonne at the mill gate or wharf). Pacific lifted A grade 20 days ago.
insert into sale_prices (customer_id, product_id, from_on, price_cents)
select c.id, p.id, x.from_on, x.cents from (values
  ('Pacific Log Exports', 'A', current_date - 400, 13500), ('Pacific Log Exports', 'A', current_date - 20, 13800),
  ('Pacific Log Exports', 'K', current_date - 400, 12000), ('Pacific Log Exports', 'KI', current_date - 400, 10500),
  ('Manawatu Sawmills', 'P1', current_date - 400, 19500), ('Manawatu Sawmills', 'S1', current_date - 400, 14000),
  ('Manawatu Sawmills', 'S2', current_date - 400, 12500), ('Central Pulp and Paper', 'PULP', current_date - 400, 5200)
) x(customer, code, from_on, cents) join customers c on c.name = x.customer join products p on p.code = x.code
on conflict (customer_id, product_id, from_on) do nothing;

insert into cartage_rates (carrier_id, customer_id, from_on, rate_cents)
select k.id, c.id, current_date - 400, x.cents from (values
  ('Hauraki Haulage', 'Pacific Log Exports', 2400), ('Hauraki Haulage', 'Manawatu Sawmills', 1500), ('Hauraki Haulage', 'Central Pulp and Paper', 1800),
  ('Tui Transport', 'Pacific Log Exports', 2300), ('Tui Transport', 'Manawatu Sawmills', 1450), ('Tui Transport', 'Central Pulp and Paper', 1750)
) x(carrier, customer, cents) join contractors k on k.name = x.carrier join customers c on c.name = x.customer
on conflict (carrier_id, customer_id, from_on) do nothing;

insert into operations (id, forest_id, code, name, crew_id, status, est_tonnes, area_ha, logging_rate_cents, planned_start, planned_end, started_on, finished_on,
  notice_given_on, plan_in_place_on, replant_planned_on, replant_notice_on) values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'TAW-H03', 'Te Awa setting 3', '30000000-0000-4000-8000-000000000001', 'active',
   9000, 21, 3200, current_date - 45, current_date + 60, current_date - 45, null, current_date - 85, current_date - 80, null, null),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'RNG-H01', 'Rangiwahia clearfell', '30000000-0000-4000-8000-000000000004', 'finished',
   1600, 14, 3400, current_date - 150, current_date - 80, current_date - 149, current_date - 75, current_date - 195, current_date - 190, current_date + 20, null),
  ('70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'MCK-H01', 'McKenzie woodlot', '30000000-0000-4000-8000-000000000001', 'planned',
   2500, 9, 3600, current_date + 15, current_date + 60, null, null, null, null, null, null),
  ('70000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'TAW-H04', 'Te Awa setting 4', '30000000-0000-4000-8000-000000000001', 'planned',
   11000, 26, 3200, current_date + 130, current_date + 220, null, null, current_date - 5, null, null, null)
on conflict (id) do nothing;

-- Te Awa setting 3: three loads a working day for the last six weeks.
with s as (
  select row_number() over (order by g.d, k) as n, g.d::date as d
  from generate_series(current_date - 44, current_date - 1, interval '1 day') g(d) cross join generate_series(1, 3) k
  where extract(isodow from g.d) < 6
), x as (
  select n, d,
    case n % 10 when 0 then 'A' when 1 then 'A' when 2 then 'A' when 3 then 'A' when 4 then 'K' when 5 then 'KI' when 6 then 'P1' when 7 then 'S1' when 8 then 'S2' else 'PULP' end as code,
    case when n % 10 <= 5 then 'Pacific Log Exports' when n % 10 <= 8 then 'Manawatu Sawmills' else 'Central Pulp and Paper' end as customer,
    (array['HHL101','HHL102','TUI7','TUI9'])[n % 4 + 1] as rego
  from s
)
insert into dockets (number, operation_id, product_id, customer_id, truck_id, loaded_on, gross_kg, tare_kg)
select 'TA' || lpad(x.n::text, 4, '0'), '70000000-0000-4000-8000-000000000001', p.id, c.id, t.id, x.d,
  case when x.n = 17 then 45600 when x.n % 4 in (0, 2) then 48800 + (x.n * 53 % 1000) else 42900 + (x.n * 37 % 1000) end, 16500
from x join products p on p.code = x.code join customers c on c.name = x.customer join trucks t on t.rego = x.rego
on conflict (number) do nothing;

-- Rangiwahia: one load a working day, five months ago, all settled.
with s as (
  select row_number() over (order by g.d) as n, g.d::date as d
  from generate_series(current_date - 148, current_date - 76, interval '1 day') g(d)
  where extract(isodow from g.d) < 6
), x as (
  select n, d,
    case n % 5 when 0 then 'A' when 1 then 'K' when 2 then 'S1' when 3 then 'S2' else 'PULP' end as code,
    case n % 5 when 0 then 'Pacific Log Exports' when 1 then 'Pacific Log Exports' when 2 then 'Manawatu Sawmills' when 3 then 'Manawatu Sawmills' else 'Central Pulp and Paper' end as customer,
    (array['HHL101','HHL102','TUI7','TUI9'])[n % 4 + 1] as rego
  from s
)
insert into dockets (number, operation_id, product_id, customer_id, truck_id, loaded_on, gross_kg, tare_kg)
select 'RW' || lpad(x.n::text, 4, '0'), '70000000-0000-4000-8000-000000000002', p.id, c.id, t.id, x.d,
  case when x.n % 4 in (0, 2) then 48600 + (x.n * 41 % 1000) else 43000 + (x.n * 29 % 800) end, 16400
from x join products p on p.code = x.code join customers c on c.name = x.customer join trucks t on t.rego = x.rego
on conflict (number) do nothing;

-- Mill statements. Every Rangiwahia load is on one. Te Awa: a few dockets missing, a few short, a few mispriced.
insert into mill_lines (customer_id, docket_number, docket_id, received_on, tonnes, levy_cents, statement_ref)
select d.customer_id, d.number, d.id, d.loaded_on + 1,
  case when d.number like 'TA%' and substr(d.number, 3)::int % 17 = 5 then round((d.gross_kg - d.tare_kg) / 1000.0 * 0.96, 3) else round((d.gross_kg - d.tare_kg) / 1000.0, 3) end,
  null, 'ST-' || to_char(d.loaded_on, 'IYYY-IW')
from dockets d
where (d.number like 'RW%' or (d.number like 'TA%' and d.loaded_on < current_date - 3 and substr(d.number, 3)::int % 23 <> 0))
on conflict (customer_id, docket_number) do nothing;

update mill_lines m set value_cents = round(l.expected_cents * case when l.docket in ('TA0027', 'TA0057') then 0.95 else 1 end),
  levy_cents = case when l.customer = 'Pacific Log Exports' then round(l.tonnes * 33) end
from v_loads l where l.id = m.docket_id and m.value_cents is null;

insert into mill_lines (customer_id, docket_number, received_on, tonnes, value_cents, statement_ref)
values ('40000000-0000-4000-8000-000000000002', 'TA9917', current_date - 6, 27.140, 380000, 'ST-demo-unmatched')
on conflict (customer_id, docket_number) do nothing;

-- Rangiwahia: invoiced, statements received, owner paid, contractors paid, levy paid.
insert into invoices (id, customer_id, number, buyer_created, issued_on, due_on, amount_cents, gst_cents, paid_on) values
  ('80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'KFM-0001', false, current_date - 70, current_date - 50, 0, 0, current_date - 12),
  ('80000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'PLE-ST-2208', true, current_date - 72, current_date - 52, 0, 0, current_date - 50),
  ('80000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'CPP-RCTI-5531', true, current_date - 70, current_date - 50, 0, 0, current_date - 44),
  ('80000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 'KFM-0002', false, current_date - 28, current_date - 8, 0, 0, null),
  ('80000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 'PLE-ST-2291', true, current_date - 12, current_date + 8, 0, 0, null)
on conflict (id) do nothing;

update dockets d set invoice_id = case c.name when 'Manawatu Sawmills' then '80000000-0000-4000-8000-000000000001'::uuid
  when 'Pacific Log Exports' then '80000000-0000-4000-8000-000000000002'::uuid else '80000000-0000-4000-8000-000000000003'::uuid end
from customers c where c.id = d.customer_id and d.number like 'RW%' and d.invoice_id is null;

update dockets d set invoice_id = '80000000-0000-4000-8000-000000000004'
from customers c where c.id = d.customer_id and c.name = 'Manawatu Sawmills' and d.number like 'TA%' and d.loaded_on < current_date - 29 and d.invoice_id is null
  and exists (select 1 from mill_lines m where m.docket_id = d.id);

update dockets d set invoice_id = '80000000-0000-4000-8000-000000000005'
from customers c where c.id = d.customer_id and c.name = 'Pacific Log Exports' and d.number like 'TA%' and d.loaded_on < current_date - 25 and d.invoice_id is null
  and exists (select 1 from mill_lines m where m.docket_id = d.id);

update invoices i set amount_cents = t.amount, gst_cents = round(t.amount * 0.15)
from (select invoice_id, sum(sale_cents) as amount from v_loads where invoice_id is not null group by invoice_id) t
where t.invoice_id = i.id and i.amount_cents = 0;

insert into owner_returns (id, owner_id, number, period_start, period_end, issued_on, tonnes, sales_cents, costs_cents, net_cents, paid_on)
values ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'OR-RNG-0001', current_date - 148, current_date - 76, current_date - 40, 0, 0, 0, 0, current_date - 35)
on conflict (id) do nothing;
update dockets set owner_return_id = '90000000-0000-4000-8000-000000000001' where number like 'RW%' and owner_return_id is null;
update owner_returns r set tonnes = t.tonnes, sales_cents = t.sales, costs_cents = t.sales - t.net, net_cents = t.net
from (select owner_return_id, sum(tonnes) as tonnes, sum(sale_cents) as sales, sum(owner_net_cents) as net from v_owner_lines where owner_return_id is not null group by owner_return_id) t
where t.owner_return_id = r.id and r.tonnes = 0;

insert into contractor_payments (id, contractor_id, number, kind, buyer_created, period_end, issued_on, tonnes, amount_cents, gst_cents, paid_on) values
  ('a0000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000004', 'BC-KAU-0001', 'logging', true, current_date - 76, current_date - 70, 0, 0, 0, current_date - 55),
  ('a0000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'BC-HAU-0001', 'cartage', true, current_date - 76, current_date - 70, 0, 0, 0, current_date - 55),
  ('a0000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'BC-TUI-0001', 'cartage', true, current_date - 76, current_date - 70, 0, 0, 0, current_date - 55)
on conflict (id) do nothing;
update dockets d set logging_pay_id = 'a0000000-0000-4000-8000-000000000001' where d.number like 'RW%' and d.logging_pay_id is null;
update dockets d set cartage_pay_id = case t.carrier_id when '30000000-0000-4000-8000-000000000002' then 'a0000000-0000-4000-8000-000000000002'::uuid else 'a0000000-0000-4000-8000-000000000003'::uuid end
from trucks t where t.id = d.truck_id and d.number like 'RW%' and d.cartage_pay_id is null;
update contractor_payments p set tonnes = t.tonnes, amount_cents = t.amount, gst_cents = round(t.amount * 0.15)
from (select logging_pay_id as pay_id, sum(tonnes) as tonnes, sum(logging_cents) as amount from v_loads where logging_pay_id is not null group by 1
      union all select cartage_pay_id, sum(tonnes), sum(cartage_cents) from v_loads where cartage_pay_id is not null group by 1) t
where t.pay_id = p.id and p.tonnes = 0;

insert into levy_payments (owner_id, month, tonnes, amount_cents, paid_on)
select owner_id, month, undeducted_tonnes, owner_to_pay_cents, (month + interval '50 days')::date from v_levy
where owner = 'Rangiwahia Partnership' and undeducted_tonnes > 0
on conflict (owner_id, month) do nothing;

insert into notes (id, operation_id, owner_id, title, body) values
  ('b0000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Skid site', 'Wet week: crew lost two days, roading contractor metalling skid 2.'),
  ('b0000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Access', 'Ian wants the boundary fence checked before the crew moves in.')
on conflict (id) do nothing;
