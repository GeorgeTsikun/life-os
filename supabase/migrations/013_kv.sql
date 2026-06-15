-- 013_kv.sql — универсальное key-value хранилище для «местных» блобов,
-- чтобы вода/цели, тренировки, база знаний, дофамин-журнал, RPG и пр.
-- синкались между устройствами. Запусти в Supabase → SQL Editor.

create table if not exists kv (
  owner       text not null default 'george',
  key         text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now(),
  primary key (owner, key)
);

alter table kv enable row level security;
do $$ begin
  create policy kv_all on kv for all using (true) with check (true);
exception when duplicate_object then null; end $$;
