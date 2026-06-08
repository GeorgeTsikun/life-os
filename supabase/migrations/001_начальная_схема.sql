-- ── LIFE OS — Начальная схема базы данных (single-user) ─────────────────────
-- Выполни в Supabase → SQL Editor → New Query → Run

-- Single-user версия: ты один пользователь системы.
-- Идентификатор — твой Telegram ID (строка) или 'george' для веб-запусков.

create extension if not exists "uuid-ossp";

-- ── ЗАДАЧИ ────────────────────────────────────────────────────────────────────
create table if not exists tasks (
  id              uuid primary key default uuid_generate_v4(),
  owner           text not null default 'george',
  text            text not null,
  quadrant        text not null check (quadrant in ('do','schedule','delegate','eliminate')),
  cat             text,
  time_label      text,
  done            boolean default false,
  xp_value        int default 50,
  notion_page_id  text,                  -- ссылка на страницу в Notion (если есть)
  defer_count     int default 0,          -- сколько раз переносил → для детектора избегания
  last_deferred_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── ПРОЕКТЫ ───────────────────────────────────────────────────────────────────
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  owner           text not null default 'george',
  name            text not null,
  emoji           text default '🚀',
  target          bigint default 0,
  current         bigint default 0,
  progress        int default 0,
  color           text default '#00F5D4',
  stage           text default 'Идея',
  tasks_count     int default 0,
  financial_impact text default 'direct',  -- direct/indirect/none
  notion_page_id  text,
  created_at      timestamptz default now()
);

-- ── ЛЮДИ / CRM ────────────────────────────────────────────────────────────────
create table if not exists people (
  id              uuid primary key default uuid_generate_v4(),
  owner           text not null default 'george',
  name            text not null,
  rel             text,
  commitment      text,
  mine            boolean default true,
  due_label       text,
  urgency         text default 'later',
  border          text,
  avatar          text default '👤',
  last_contact    text default 'сегодня',
  notes           text,
  log             jsonb default '[]'::jsonb,
  notion_page_id  text,
  created_at      timestamptz default now()
);

-- ── ОЖИДАНИЯ (умные, с контекстом) ────────────────────────────────────────────
create table if not exists waitings (
  id              uuid primary key default uuid_generate_v4(),
  owner           text not null default 'george',
  person_id       uuid references people(id) on delete set null,
  person_name     text,                    -- если человек не в базе
  what            text not null,           -- что ждём
  context         text,                    -- почему важно, что они говорили
  fallback_plan   text,                    -- что делать если не пришло
  due_date        date,
  status          text default 'waiting' check (status in ('waiting','received','overdue','cancelled')),
  pinged_count    int default 0,
  last_pinged_at  timestamptz,
  notion_page_id  text,
  created_at      timestamptz default now()
);

-- ── ЗДОРОВЬЕ (от Apple Health) ────────────────────────────────────────────────
create table if not exists health_metrics (
  id                  uuid primary key default uuid_generate_v4(),
  owner               text not null default 'george',
  date                date not null,
  sleep_h             numeric(4,2),
  sleep_quality_pct   int,
  deep_pct            int,
  rem_pct             int,
  hrv_ms              int,
  resting_hr          int,
  steps               int,
  calories_burned     int,
  km                  numeric(5,2),
  move_pct            int,
  exercise_pct        int,
  stand_pct           int,
  synced_at           timestamptz default now(),
  unique (owner, date)
);

-- ── ПИТАНИЕ ───────────────────────────────────────────────────────────────────
create table if not exists nutrition_log (
  id                uuid primary key default uuid_generate_v4(),
  owner             text not null default 'george',
  date              date not null,
  water_l           numeric(4,2) default 0,
  calories          int default 0,
  protein_g         int default 0,
  carbs_g           int default 0,
  fat_g             int default 0,
  supplements_done  boolean default false,
  shower_done       boolean default false,
  score             int default 0,
  unique (owner, date)
);

-- ── ТРЕНИРОВКИ ────────────────────────────────────────────────────────────────
create table if not exists workouts (
  id           uuid primary key default uuid_generate_v4(),
  owner        text not null default 'george',
  date         date not null,
  type         text not null,
  duration_min int default 0,
  xp_earned    int default 0,
  emoji        text default '🏋️',
  notes        text,
  created_at   timestamptz default now()
);

-- ── XP СОБЫТИЯ ────────────────────────────────────────────────────────────────
create table if not exists xp_events (
  id          uuid primary key default uuid_generate_v4(),
  owner       text not null default 'george',
  date        date not null default current_date,
  source      text,
  amount      int not null,
  description text,
  created_at  timestamptz default now()
);

-- ── ДОСТИЖЕНИЯ ────────────────────────────────────────────────────────────────
create table if not exists achievements (
  id           uuid primary key default uuid_generate_v4(),
  owner        text not null default 'george',
  achievement_key text not null,
  unlocked_at  timestamptz default now(),
  unique (owner, achievement_key)
);

-- ── ПРОФИЛЬ ───────────────────────────────────────────────────────────────────
create table if not exists profile (
  owner        text primary key default 'george',
  name         text default 'ДЖОРДЖ',
  tagline      text default 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР',
  avatar       text default '👑',
  xp           bigint default 50141,
  level        int default 7,
  streak       int default 7,
  last_active  date,
  rpg_stats    jsonb default '{"STR":62,"VIT":70,"INT":58,"CHA":55,"WIS":48,"FOC":52}'::jsonb,
  updated_at   timestamptz default now()
);

-- ── ДНЕВНИК ───────────────────────────────────────────────────────────────────
create table if not exists daily_log (
  id           uuid primary key default uuid_generate_v4(),
  owner        text not null default 'george',
  date         date not null default current_date,
  energy_level int default 7,
  mood         text default '😊',
  focus_h      numeric(4,2) default 0,
  note         text,
  unique (owner, date)
);

-- ── КВЕСТЫ ───────────────────────────────────────────────────────────────────
create table if not exists quests (
  id           uuid primary key default uuid_generate_v4(),
  owner        text not null default 'george',
  date         date not null default current_date,
  title        text not null,
  icon         text default '🎯',
  xp_reward    int default 150,
  completed    boolean default false,
  quest_type   text default 'daily'
);

-- ── ВХОДЯЩИЕ (буфер до классификации) ────────────────────────────────────────
create table if not exists inbox (
  id           uuid primary key default uuid_generate_v4(),
  owner        text not null default 'george',
  source       text,                       -- telegram, mini_app, email
  raw_text     text not null,
  audio_url    text,
  processed    boolean default false,
  classified_as text,                       -- task, idea, decision, meeting...
  notion_page_id text,
  created_at   timestamptz default now()
);

-- ── СВЯЗЬ TELEGRAM ↔ ВЛАДЕЛЕЦ ─────────────────────────────────────────────────
create table if not exists tg_users (
  telegram_id  text primary key,
  owner        text not null default 'george',
  linked_at    timestamptz default now()
);

-- ── ИНДЕКСЫ ───────────────────────────────────────────────────────────────────
create index if not exists idx_tasks_owner_done    on tasks(owner, done);
create index if not exists idx_tasks_quadrant      on tasks(owner, quadrant) where done = false;
create index if not exists idx_tasks_defer         on tasks(defer_count) where done = false;
create index if not exists idx_health_date         on health_metrics(owner, date desc);
create index if not exists idx_xp_date             on xp_events(owner, date desc);

-- ── RLS — пока выключено (single-user), при мульти-юзере включим ────────────
alter table tasks         disable row level security;
alter table projects      disable row level security;
alter table people        disable row level security;
alter table waitings      disable row level security;
alter table health_metrics disable row level security;
alter table nutrition_log disable row level security;
alter table workouts      disable row level security;
alter table xp_events     disable row level security;
alter table achievements  disable row level security;
alter table profile       disable row level security;
alter table daily_log     disable row level security;
alter table quests        disable row level security;
alter table inbox         disable row level security;
alter table tg_users      disable row level security;

-- ── НАЧАЛЬНЫЕ ДАННЫЕ ──────────────────────────────────────────────────────────
insert into profile (owner, name, tagline)
values ('george', 'ДЖОРДЖ', 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР')
on conflict (owner) do nothing;
