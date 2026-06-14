-- 011_task_links.sql — привязка задач к проектам и людям
-- Запусти в Supabase → SQL Editor.

alter table tasks add column if not exists project_id text;
alter table tasks add column if not exists person_id  text;

create index if not exists tasks_project_idx on tasks (project_id);
create index if not exists tasks_person_idx  on tasks (person_id);
