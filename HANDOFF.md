# LIFE OS — Handoff (для нового окна)

**Проект:** Telegram Mini App (Vercel) + бот (Railway, grammy) + Supabase REST. Ваниль ES-модули, без сборки. Single-user `owner='george'`. Кэш-бастинг `?v=NN` (сейчас **v63**). Репо: `GeorgeTsikun/life-os`.

## Где что
- Фронт: `index.html`, `js/` (db.js, supabaseSync.js, screens/*), `css/`. Бот: `bot/`. Serverless: `api/`. Миграции: `supabase/migrations/` (применять вручную в SQL Editor).
- Роадмап + аудит по большому ТЗ: `~/.claude/plans/snazzy-roaming-balloon.md`.
- Память (профиль/финансы/проекты/sync-модель): `~/.claude/.../memory/MEMORY.md`.

## Сделано недавно
- Синк Фаза 0: newest-wins по меткам (`lifeos_sync_meta`) для KV (вода/дофамин/спорт/знания/цели/rpg). `supabaseSync.js`.
- Модель ИИ — рантайм-конфиг: таблица `config.life_model`, `getActiveModel()` (bot/model.js, api/_lib/model.js). Команды `/getmodel /models /setmodel`. Дефолт `gpt-5.5`. Фикс: `max_completion_tokens`, убран `temperature`.
- AI-коуч дня (Фаза 1, первый заход): `bot/coach.js` — контекст→план по часам→создаёт задачи. Команда `/coach`, утро 08:10.
- Финансы (вкладка Деньги), еда (фото/текст/голос), CRM, база знаний, дофамин-бюджет, фото тела синк.
- Вечерний разбор → универсальный дамп: рассказ о дне → задачи/еда/вода/идеи + снимок `day_log`. `/razbor`, авто на ответ после 21:00.
- Цели (KV `lifegoals`): `/goal /goalp /goals /progress` (% к цели, темп недели, вероятность, ИИ-рек). `bot/goals.js` + фронт-виджет 🎯 ЦЕЛИ. Кэш `?v=64`.
- Созвон → решения/обязательства/риски: `bot/meeting.js`, `/meeting` + авто на аудио. Мои→задачи, чужие→ожидания, всё→`meeting_notes`.
- Второй мозг: `/recall` (RAG-lite, RPC `search_brain` full-text → ИИ по найденным фрагментам) + `/export` (снимок в Markdown для Obsidian). `bot/brain.js`, `bot/export.js`.

## Надо применить в Supabase (если ещё нет)
Миграции 007–017 (meals, finance, task_links, body_photos, kv, config, **015 day_log**, **016 meeting_notes**, **017 search_brain** — RPC full-text). Raw: `raw.githubusercontent.com/GeorgeTsikun/life-os/main/supabase/migrations/<файл>`.

## Следующие шаги (по роадмапу, порядок на «живость»)
1. Вечерний разбор коуча: свободный текст вечером → авто закрыть/перенести задачи + план на завтра. (`bot/scheduling.js` вечерний чекин + coach).
2. **Цели** как сущность (год/квартал/месяц) + авто-разбивка на задачи.
3. Созвон→решения/обязательства/риски (структурный разбор `meeting_notes`).
4. Второй мозг — поиск по истории (inbox/решения/идеи).
5. Тайм-трекинг задач, еда edit/база блюд, контакты в 1 тап, повторяющиеся задачи, дедуп видов, Apple Health, Notion, ИИ-агенты.

## Метод
Код → `node --check` → бамп `?v=NN` → commit/push (Co-Authored-By: Claude Opus 4.8) → миграция если есть → проверка на устройстве. Модель меняется командой `/setmodel`, не env. Ponytail-режим включён (минимальный код).
