-- 017_search_brain.sql — второй мозг: полнотекстовый поиск по всей истории.
-- Один RPC, русская морфология (websearch_to_tsquery). Без новых таблиц/инфры.
CREATE OR REPLACE FUNCTION search_brain(search_q text, lim int DEFAULT 20)
RETURNS TABLE(source text, title text, snippet text, ts timestamptz)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT websearch_to_tsquery('russian', search_q) AS tsq)
  SELECT * FROM (
    SELECT 'идея'::text, left(text,80), left(coalesce(text,'')||' '||coalesce(notes,''),300), created_at
      FROM idea_bank, q WHERE to_tsvector('russian', coalesce(text,'')||' '||coalesce(notes,'')) @@ tsq
    UNION ALL
    SELECT 'созвон', coalesce(title,'Созвон'), left(coalesce(summary,'')||' '||coalesce(transcript,''),300), created_at
      FROM meeting_notes, q WHERE to_tsvector('russian', coalesce(title,'')||' '||coalesce(summary,'')||' '||coalesce(transcript,'')) @@ tsq
    UNION ALL
    SELECT 'день '||to_char(date,'DD.MM'), 'Итог дня', left(coalesce(summary,'')||' '||coalesce(report,''),300), created_at
      FROM day_log, q WHERE to_tsvector('russian', coalesce(report,'')||' '||coalesce(summary,'')) @@ tsq
    UNION ALL
    SELECT 'инбокс', coalesce(classified_as,'заметка'), left(raw_text,300), created_at
      FROM inbox, q WHERE to_tsvector('russian', coalesce(raw_text,'')) @@ tsq
    UNION ALL
    SELECT 'задача', left(text,80), left(text,300), created_at
      FROM tasks, q WHERE to_tsvector('russian', coalesce(text,'')) @@ tsq
    UNION ALL
    SELECT 'проект', name, name, created_at
      FROM projects, q WHERE to_tsvector('russian', coalesce(name,'')) @@ tsq
    UNION ALL
    SELECT 'человек', name, left(coalesce(commitment,'')||' '||coalesce(notes,''),300), created_at
      FROM people, q WHERE to_tsvector('russian', coalesce(name,'')||' '||coalesce(commitment,'')||' '||coalesce(notes,'')) @@ tsq
    UNION ALL
    SELECT 'жду от '||coalesce(owner_name,'?'), coalesce(owner_name,'?'), left(coalesce(what,'')||' '||coalesce(context,''),300), created_at
      FROM expectations, q WHERE to_tsvector('russian', coalesce(what,'')||' '||coalesce(context,'')) @@ tsq
  ) r
  ORDER BY ts DESC NULLS LAST
  LIMIT lim;
$$;
