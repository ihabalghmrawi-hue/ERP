insert into customers (id, name, phone, email, location, budget, interest_type, lead_tag)
values
  ('11111111-1111-1111-1111-111111111111', 'Mona Adel', '+1-555-1022', 'mona@example.com', 'Austin, TX', 180000, 'Real Estate', 'hot'),
  ('22222222-2222-2222-2222-222222222222', 'Omar Samir', '+1-555-2033', 'omar@example.com', 'Dallas, TX', 65000, 'Finishing Package', 'warm')
on conflict (id) do nothing;

insert into deals (customer_id, stage, engagement_level, value)
values
  ('11111111-1111-1111-1111-111111111111', 'negotiation', 86, 170000),
  ('22222222-2222-2222-2222-222222222222', 'contacted', 52, 59000);

insert into interactions (customer_id, kind, note, responded_in_minutes, created_at)
values
  ('11111111-1111-1111-1111-111111111111', 'call', 'Asked for installment plan', 8, now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 'meeting', 'Visited project site', 30, now() - interval '12 hour'),
  ('22222222-2222-2222-2222-222222222222', 'whatsapp', 'Requested catalog', 240, now() - interval '4 day');
