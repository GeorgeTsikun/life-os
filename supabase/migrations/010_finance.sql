-- 010_finance.sql — хранилище финансового модуля (один JSON-документ на владельца)
-- Запусти в Supabase → SQL Editor.

create table if not exists finance (
  owner       text primary key default 'george',
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table finance enable row level security;
do $$ begin
  create policy finance_all on finance for all using (true) with check (true);
exception when duplicate_object then null; end $$;
