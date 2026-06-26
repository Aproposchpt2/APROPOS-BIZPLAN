-- Business Center one-time activation support
-- Run this once in the Supabase SQL editor for the shared Business Center project.

alter table public.biz_center_members
  add column if not exists bc_access_activated boolean not null default false,
  add column if not exists bc_access_activated_at timestamptz;

create index if not exists idx_biz_center_members_bc_access_activated
  on public.biz_center_members (email, bc_access_activated);

comment on column public.biz_center_members.bc_access_activated is
  'True after the member verifies their welcome-email CapGen access code one time at AIBizCenter.';

comment on column public.biz_center_members.bc_access_activated_at is
  'Timestamp of the member one-time Business Center contract dashboard activation.';

-- Federal CapGen OTP codes for activated Business Center members.
create table if not exists public.capgen_member_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_capgen_member_login_codes_lookup
  on public.capgen_member_login_codes (email, code, expires_at desc);

create index if not exists idx_capgen_member_login_codes_email
  on public.capgen_member_login_codes (email);
