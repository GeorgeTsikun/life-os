-- ── Даты, архив, редактирование задач ───────────────────────────────────────
-- Выполни в Supabase → SQL Editor → Run

-- Канонические поля для задач
alter table tasks
  add column if not exists due_date     date,                       -- основная дата для группировки
  add column if not exists start_iso    text,                       -- ISO 8601 для точного времени
  add column if not exists completed_at timestamptz,                 -- когда отмечено выполненной
  add column if not exists notes        text,                        -- свободные заметки
  add column if not exists subtasks     jsonb default '[]'::jsonb,   -- подзадачи [{text, done}]
  add column if not exists duration_min int default 60;              -- длительность для календаря

-- Индексы для быстрых запросов
create index if not exists idx_tasks_due       on tasks(owner, due_date) where done = false;
create index if not exists idx_tasks_done_at   on tasks(owner, completed_at desc) where done = true;
create index if not exists idx_tasks_undone    on tasks(owner, created_at desc)   where done = false;
