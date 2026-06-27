-- CapGen auto-access via AIBizCenter intake qualification
-- Run once in the shared Supabase project if these objects do not already exist.

alter table public.biz_center_members
  add column if not exists capgen_qualified boolean default false;

create table if not exists public.capgen_bc_profiles (
  email text primary key,
  full_name text,
  business_name text,
  industry text,
  city text,
  state text,
  member_type text not null default 'bc_member',
  profile_complete boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_capgen_bc_profiles_member_type
  on public.capgen_bc_profiles (member_type);

comment on column public.biz_center_members.capgen_qualified is
  'True when AIBizCenter intake qualifies the member for CapGen auto-access.';

comment on table public.capgen_bc_profiles is
  'Business Center member profiles auto-provisioned for CapGen-family dashboards.';
