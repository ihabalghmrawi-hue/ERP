-- AI CRM MVP schema (Supabase/PostgreSQL)
create extension if not exists "pgcrypto";

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text unique not null,
  location text,
  budget numeric(12,2) not null default 0,
  interest_type text not null,
  lead_tag text not null default 'cold' check (lead_tag in ('hot','warm','cold')),
  sales_rep_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (kind in ('call','whatsapp','meeting')),
  note text,
  responded_in_minutes integer,
  created_at timestamptz not null default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  stage text not null check (stage in ('lead','contacted','negotiation','closed')),
  engagement_level integer not null default 0 check (engagement_level between 0 and 100),
  value numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_insights (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  likelihood_score integer not null check (likelihood_score between 0 and 100),
  intent_class text not null check (intent_class in ('High intent','Medium intent','Low intent')),
  best_contact_time text not null,
  recommended_offer text not null,
  model_version text not null default 'rules-v1',
  created_at timestamptz not null default now()
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  due_at timestamptz not null,
  reminder_text text not null,
  status text not null default 'pending' check (status in ('pending','done','snoozed','cancelled')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  follow_up_id uuid references follow_ups(id) on delete set null,
  channel text not null default 'in_app' check (channel in ('in_app','push')),
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_sales_rep_id on customers(sales_rep_id);
create index if not exists idx_interactions_customer_id_created_at on interactions(customer_id, created_at desc);
create index if not exists idx_deals_customer_id on deals(customer_id);
create index if not exists idx_deals_stage on deals(stage);
create index if not exists idx_ai_insights_customer_id on ai_insights(customer_id);
create index if not exists idx_follow_ups_due_at_status on follow_ups(due_at, status);
create index if not exists idx_notifications_customer_id_created_at on notifications(customer_id, created_at desc);
