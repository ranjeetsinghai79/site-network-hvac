-- Leads table — run once in Supabase SQL editor
create table if not exists leads (
  id               uuid        default gen_random_uuid() primary key,
  place_id         text        unique not null,
  name             text        not null,
  phone            text,
  email            text,
  website          text,
  address          text,
  city             text,
  state            text,
  niche            text,
  site_score       integer,
  site_issues      jsonb,
  brand_data       jsonb,
  config_ts        text,
  github_repo      text,
  vercel_url       text,
  outreach_sent    boolean     default false,
  outreach_sent_at timestamptz,
  status           text        default 'found',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- Indexes for pipeline queries
create index if not exists leads_status_idx on leads (status);
create index if not exists leads_niche_idx  on leads (niche);
create index if not exists leads_city_idx   on leads (city);
create index if not exists leads_created_idx on leads (created_at desc);

-- Quick sanity check
select 'Schema ready. Leads table created.' as result;
