-- 012_body_photos.sql — фото трансформации тела (До / Цель) в облаке,
-- чтобы они были на всех устройствах, а не только локально.
-- Запусти в Supabase → SQL Editor.

alter table profile add column if not exists body_before text;
alter table profile add column if not exists body_target text;
