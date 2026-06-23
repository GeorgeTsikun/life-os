-- 020_wipe_fake_cloud.sql — стереть выдуманные данные из облака (v3: только реальное).
-- Эти данные синкались обратно в приложение и «воскрешали» фейк после локальной чистки.
-- Реальные значения вернутся из дневных отчётов / бота / Apple Health.

-- RPG-радар «Состояние героя» (KV)
DELETE FROM kv WHERE owner = 'george' AND key = 'rpgStats';
-- Авто-«полученные» достижения (заслужишь реально — отметятся заново)
DELETE FROM achievements WHERE owner = 'george';
-- Сид-здоровье из 008 (HRV/сон/шаги) — реальные придут из Apple Health/бота
DELETE FROM health_metrics WHERE owner = 'george';
