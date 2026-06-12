-- ── Миграция 005: Ожидания (CRM) + Банк идей ─────────────────────────────────

-- Ожидания: "жду от других"
CREATE TABLE IF NOT EXISTS expectations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner       TEXT NOT NULL DEFAULT 'george',
  owner_name  TEXT NOT NULL,           -- от кого жду
  what        TEXT NOT NULL,           -- что жду
  deadline    DATE,
  context     TEXT,
  trigger     TEXT,                    -- действие если не пришло
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS expectations_owner_status_idx ON expectations(owner, status);

-- Банк идей: Q4-задачи, автоматически сюда после 48ч
CREATE TABLE IF NOT EXISTS idea_bank (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner          TEXT NOT NULL DEFAULT 'george',
  text           TEXT NOT NULL,
  cat            TEXT,
  notes          TEXT,
  source_task_id TEXT,                 -- id исходной Q4-задачи
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idea_bank_owner_idx ON idea_bank(owner);

-- RLS
ALTER TABLE expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_bank     ENABLE ROW LEVEL SECURITY;

-- Политики (читаем/пишем только свои данные)
CREATE POLICY "expectations_owner" ON expectations
  USING (owner = current_setting('app.current_user', true))
  WITH CHECK (owner = current_setting('app.current_user', true));

CREATE POLICY "idea_bank_owner" ON idea_bank
  USING (owner = current_setting('app.current_user', true))
  WITH CHECK (owner = current_setting('app.current_user', true));
