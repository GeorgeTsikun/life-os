-- 015_day_log.sql — исторический снимок каждого дня (для восстановления событий + подбивок недели/месяца)
CREATE TABLE IF NOT EXISTS day_log (
  owner           TEXT NOT NULL DEFAULT 'george',
  date            DATE NOT NULL,
  report          TEXT,            -- сырой рассказ (текст/расшифровка голоса)
  summary         TEXT,            -- итог дня одной фразой от коуча
  done_count      INT DEFAULT 0,
  moved_count     INT DEFAULT 0,
  new_count       INT DEFAULT 0,
  meals_count     INT DEFAULT 0,
  water_added_ml  INT DEFAULT 0,
  ideas_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, date)
);

ALTER TABLE day_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "day_log_owner" ON day_log FOR ALL USING (true) WITH CHECK (true);
