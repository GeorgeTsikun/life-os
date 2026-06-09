-- ── КОНТЕНТ — таблицы для блог-направления ──────────────────────────────────
-- Выполни в Supabase → SQL Editor → Run

create extension if not exists "uuid-ossp";

-- ── ЕДИНИЦА КОНТЕНТА ──────────────────────────────────────────────────────────
create table if not exists content_items (
  id            uuid primary key default uuid_generate_v4(),
  owner         text not null default 'george',

  title         text not null,
  text          text,                      -- сценарий / текст поста / описание
  notes         text,                      -- внутренние заметки, комментарии

  platforms     text[] default '{}',       -- ['instagram','threads','youtube','telegram','tiktok','dzen']
  content_type  text,                      -- reel, carousel, story, short, post, longvideo, article, thread

  status        text default 'idea' check (status in (
                  'idea','script','shooting','editing','scheduled','published'
                )),

  publish_date  date,                      -- запланированная или фактическая дата выхода
  scheduled_at  timestamptz,               -- точное время если запланировано

  refs          text[] default '{}',       -- URL ссылок-референсов
  attachments   jsonb default '[]'::jsonb, -- файлы/фото/видео (метаданные)

  hashtags      text[] default '{}',       -- готовые хештеги
  caption       text,                      -- готовый caption для публикации

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── МЕТРИКИ ПОСЛЕ ПУБЛИКАЦИИ ─────────────────────────────────────────────────
create table if not exists content_metrics (
  id           uuid primary key default uuid_generate_v4(),
  content_id   uuid references content_items(id) on delete cascade,
  owner        text not null default 'george',

  platform     text not null,              -- instagram, youtube...
  views        int default 0,
  likes        int default 0,
  comments     int default 0,
  shares       int default 0,
  saves        int default 0,
  reach        int default 0,
  followers_gained int default 0,

  measured_at  timestamptz default now()
);

-- ── ИНДЕКСЫ ──────────────────────────────────────────────────────────────────
create index if not exists idx_content_owner_status on content_items(owner, status);
create index if not exists idx_content_platforms    on content_items using gin(platforms);
create index if not exists idx_metrics_content      on content_metrics(content_id, platform);

-- ── RLS — выключено (single-user) ────────────────────────────────────────────
alter table content_items   disable row level security;
alter table content_metrics disable row level security;
