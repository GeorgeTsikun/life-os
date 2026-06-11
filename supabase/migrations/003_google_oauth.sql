-- ── Google OAuth — хранение токенов и маппинг календарей ─────────────────────
-- Выполни в Supabase → SQL Editor → Run

create extension if not exists "uuid-ossp";

-- Refresh + access токены OAuth (по одному на пользователя+провайдера)
create table if not exists oauth_tokens (
  id            uuid primary key default uuid_generate_v4(),
  owner         text not null default 'george',
  provider      text not null,                 -- 'google', etc.
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz,
  scope         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (owner, provider)
);

-- Маппинг "категория задачи" → "ID календаря в Google"
-- Например: Работа → 💎 Рабочие задачи
create table if not exists calendar_mapping (
  id             uuid primary key default uuid_generate_v4(),
  owner          text not null default 'george',
  category       text not null,                -- 'Работа', 'Контент', и т.д.
  calendar_id    text not null,                -- ID календаря в Google
  calendar_name  text,                         -- человекочитаемое имя
  color          text,                         -- цвет
  updated_at     timestamptz default now(),
  unique (owner, category)
);

-- В tasks добавим поле google_event_id чтобы потом обновлять/удалять события
alter table tasks
  add column if not exists google_event_id text,
  add column if not exists google_event_link text;

alter table oauth_tokens     disable row level security;
alter table calendar_mapping disable row level security;
