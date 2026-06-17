-- 018_people_contacts.sql — контакты в один тап (телефон + Telegram)
ALTER TABLE people ADD COLUMN IF NOT EXISTS phone        TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS tg_username  TEXT;
