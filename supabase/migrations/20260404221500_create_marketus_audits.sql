create extension if not exists pgcrypto;

create table if not exists public.marketus_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'started',
  first_name text,
  email text,
  website text,
  agency_size text,
  challenge text,
  ai_setup text,
  biggest_opportunity text,
  tools text,
  context text,
  generated_summary text,
  summary_fit text,
  summary_notes text,
  source text not null default 'marketus-ai',
  meta jsonb not null default '{}'::jsonb
);

create index if not exists marketus_audits_created_at_idx on public.marketus_audits (created_at desc);
create index if not exists marketus_audits_status_idx on public.marketus_audits (status);
create index if not exists marketus_audits_email_idx on public.marketus_audits (email);

create or replace function public.set_marketus_audits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_marketus_audits_updated_at on public.marketus_audits;
create trigger trg_marketus_audits_updated_at
before update on public.marketus_audits
for each row
execute function public.set_marketus_audits_updated_at();

alter table public.marketus_audits enable row level security;

create policy "service role full access on marketus audits"
on public.marketus_audits
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
