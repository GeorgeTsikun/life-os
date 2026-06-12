-- ── ДЕДУПЛИКАЦИЯ ЗАДАЧ ────────────────────────────────────────────────────────
-- Удаляет дубликаты: оставляет один ряд на каждую задачу (предпочитая done=true),
-- затем удаляет задачи с нечисловыми не-UUID id (старый баг t1234...).

-- Шаг 1: оставляем из дублей по тексту только один ряд (с done=true если есть)
DELETE FROM tasks
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY owner, text
             ORDER BY done DESC, created_at ASC
           ) AS rn
    FROM tasks
    WHERE owner = 'george'
  ) ranked
  WHERE rn > 1
);

-- Шаг 2: удаляем записи с невалидными id (не UUID формат)
DELETE FROM tasks
WHERE owner = 'george'
  AND id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Шаг 3: проверяем сколько осталось
SELECT COUNT(*) AS tasks_left, COUNT(*) FILTER (WHERE done) AS done_count FROM tasks WHERE owner = 'george';
