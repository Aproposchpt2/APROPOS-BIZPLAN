-- Business Center one-time activation support
-- Run this once in the Supabase SQL editor for the shared project:
-- https://judislfknmhofcgzyozc.supabase.co

alter table public.biz_center_members
  add column if not exists bc_access_activated boolean not null default false,
  add column if not exists bc_access_activated_at timestamptz;

create index if not exists idx_biz_center_members_bc_access_activated
  on public.biz_center_members (email, bc_access_activated);

comment on column public.biz_center_members.bc_access_activated is
  'True after the member verifies their welcome-email CapGen access code one time at AIBizCenter.';

comment on column public.biz_center_members.bc_access_activated_at is
  'Timestamp of the member one-time Business Center contract dashboard activation.';
