-- 014_config.sql — рантайм-конфиг (модель ИИ и пр.) без правок env/деплоя.
-- Запусти в Supabase → SQL Editor.

create table if not exists config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

alter table config enable row level security;
do $$ begin
  create policy config_all on config for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- стартовое значение (можно менять из бота /setmodel)
insert into config (key, value) values ('life_model', 'gpt-5.5')
on conflict (key) do nothing;
