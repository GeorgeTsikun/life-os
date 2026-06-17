-- 016_meeting_notes.sql — структурный разбор созвона (решения/обязательства/риски)
CREATE TABLE IF NOT EXISTS meeting_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner        TEXT NOT NULL DEFAULT 'george',
  title        TEXT,
  date         DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Moscow')::date,
  summary      TEXT,            -- 2-3 фразы о чём договорились
  decisions    JSONB DEFAULT '[]'::jsonb,   -- ["решение", ...]
  commitments  JSONB DEFAULT '[]'::jsonb,   -- [{who, what, due}]
  risks        JSONB DEFAULT '[]'::jsonb,   -- ["риск", ...]
  transcript   TEXT,            -- сырой транскрипт
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_notes_owner_date_idx ON meeting_notes(owner, date DESC);
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_notes_owner" ON meeting_notes FOR ALL USING (true) WITH CHECK (true);
