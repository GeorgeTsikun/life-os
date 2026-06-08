-- ── LIFE OS — Начальная схема базы данных ────────────────────────────────────
-- Выполни в Supabase → SQL Editor

-- Включаем UUID
create extension if not exists "uuid-ossp";

-- ── ЗАДАЧИ ────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  quadrant    text not null check (quadrant in ('do','schedule','delegate','eliminate')),
  cat         text,
  time_label  text,
  done        boolean default false,
  xp_value    int default 50,
  created_at  timestamptz default now()
);

-- ── ПРОЕКТЫ ───────────────────────────────────────────────────────────────────
create table if not exists projects (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  emoji        text default '🚀',
  target       bigint default 0,
  current      bigint default 0,
  progress     int default 0,
  color        text default '#00F5D4',
  stage        text default 'Идея',
  tasks_count  int default 0,
  created_at   timestamptz default now()
);

-- ── ЛЮДИ / CRM ────────────────────────────────────────────────────────────────
create table if not exists people (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  rel         text,
  commitment  text,
  mine        boolean default true,
  due_label   text,
  urgency     text default 'later',
  border      text,
  avatar      text default '👤',
  last_contact text default 'сегодня',
  notes       text,
  log         jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- ── ЗДОРОВЬЕ (от Apple Health через Shortcuts) ────────────────────────────────
create table if not exists health_metrics (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  sleep_h           numeric(4,2),
  sleep_quality_pct int,
  deep_pct          int,
  rem_pct           int,
  hrv_ms            int,
  resting_hr        int,
  steps             int,
  calories_burned   int,
  km                numeric(5,2),
  move_pct          int,
  exercise_pct      int,
  stand_pct         int,
  synced_at         timestamptz default now(),
  unique (user_id, date)
);

-- ── ПИТАНИЕ ───────────────────────────────────────────────────────────────────
create table if not exists nutrition_log (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null,
  water_l          numeric(4,2) default 0,
  calories         int default 0,
  protein_g        int default 0,
  carbs_g          int default 0,
  fat_g            int default 0,
  supplements_done boolean default false,
  shower_done      boolean default false,
  score            int default 0,
  unique (user_id, date)
);

-- ── ТРЕНИРОВКИ ────────────────────────────────────────────────────────────────
create table if not exists workouts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  type        text not null,
  duration_min int default 0,
  xp_earned   int default 0,
  emoji       text default '🏋️',
  notes       text,
  created_at  timestamptz default now()
);

-- ── XP СОБЫТИЯ ───────────────────────────────────────────────────────────────
create table if not exists xp_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  source      text,
  amount      int not null,
  description text,
  created_at  timestamptz default now()
);

-- ── ДОСТИЖЕНИЯ ────────────────────────────────────────────────────────────────
create table if not exists achievements (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  key          text not null,
  unlocked_at  timestamptz default now(),
  unique (user_id, key)
);

-- ── ПРОФИЛЬ / XP ─────────────────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text default 'ГЕРОЙ',
  tagline     text default 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР',
  avatar      text default '👑',
  xp          bigint default 0,
  level       int default 1,
  streak      int default 0,
  last_active date,
  created_at  timestamptz default now()
);

-- ── ДНЕВНИК ───────────────────────────────────────────────────────────────────
create table if not exists daily_log (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null default current_date,
  energy_level int default 7,
  mood         text default '😊',
  focus_h      numeric(4,2) default 0,
  note         text,
  unique (user_id, date)
);

-- ── RLS — КАЖДЫЙ ВИДИТ ТОЛЬКО СВОЁ ───────────────────────────────────────────
do $$ declare
  таблицы text[] := array['tasks','projects','people','health_metrics',
                           'nutrition_log','workouts','xp_events','achievements',
                           'profiles','daily_log'];
  т text;
begin
  foreach т in array таблицы loop
    execute format('alter table %I enable row level security', т);
    execute format(
      'create policy if not exists "Только свои данные" on %I
       for all using (auth.uid() = user_id)', т);
  end loop;
end $$;

-- ── АВТОСОЗДАНИЕ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ ─────────────────────────────────────
create or replace function public.создать_профиль()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'ГЕРОЙ'));
  return new;
end;
$$;

drop trigger if exists при_регистрации on auth.users;
create trigger при_регистрации
  after insert on auth.users
  for each row execute function public.создать_профиль();
