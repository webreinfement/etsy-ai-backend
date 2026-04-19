-- Run this in the Supabase SQL editor to set up your database

create table license_keys (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  email text not null,
  tier integer default 1 check (tier in (1, 2)),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'active' check (status in ('active', 'expired', 'revoked')),
  usage_count integer default 0,
  daily_usage integer default 0,
  last_used_date text,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- Index for fast key lookups
create index on license_keys (key);
create index on license_keys (stripe_subscription_id);
