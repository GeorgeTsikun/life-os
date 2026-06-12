-- ── ДЕДУПЛИКАЦИЯ ЗАДАЧ ────────────────────────────────────────────────────────
-- Оставляет один ряд на каждую уникальную задачу (по owner+text),
-- предпочитая строку с done=true и более ранней датой создания.

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

-- Проверяем результат
SELECT COUNT(*) AS tasks_left, COUNT(*) FILTER (WHERE done) AS done_count 
FROM tasks WHERE owner = 'george';
