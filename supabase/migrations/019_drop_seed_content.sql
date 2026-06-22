-- 019_drop_seed_content.sql — убрать демо-контент (v3: без выдуманных данных).
-- Это сид из старого content.js (c1–c4), он воскресал при синке.
DELETE FROM content_items WHERE owner = 'george' AND id IN ('c1','c2','c3','c4');
