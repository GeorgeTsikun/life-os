-- 007_meals.sql — Cal AI: приёмы пищи (фото-анализ КБЖУ)
-- Запусти в Supabase Dashboard → SQL Editor.

create table if not exists meals (
  id            uuid primary key default gen_random_uuid(),
  owner         text not null default 'george',
  date          date not null default current_date,
  time_label    text,
  meal_type     text,                       -- breakfast | lunch | dinner | snack
  name          text,
  items         jsonb default '[]'::jsonb,   -- [{name, calories}]
  calories      int  default 0,
  protein       int  default 0,
  fat           int  default 0,
  carbs         int  default 0,
  weight_g      int,
  health_score  int,                         -- 1..10
  photo         text,                        -- сжатый data-URL превью
  note          text,
  created_at    timestamptz default now()
);

create index if not exists meals_owner_date_idx on meals (owner, date);

-- RLS: single-user, открываем сервис-ключу (как остальные таблицы проекта)
alter table meals enable row level security;
do $$ begin
  create policy meals_all on meals for all using (true) with check (true);
exception when duplicate_object then null; end $$;
