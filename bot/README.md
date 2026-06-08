# 🤖 LIFE OS — Telegram-бот

AI-директор в Telegram. Расшифровывает голос, классифицирует, открывает Mini App.

## Что умеет

| Команда | Описание |
|---|---|
| `/start` | Приветствие + кнопка открыть Mini App |
| `/today` | Утренний брифинг от AI с твоим контекстом |
| `/summary` | Вечерний чек-ин — расскажи итоги дня |
| `/chat` | Режим длительного разговора с памятью |
| `/reset` | Очистить контекст беседы |
| `/add <текст>` | Быстро добавить задачу |
| `/note <текст>` | Идея в банк |
| `/wait <текст>` | Ожидание от человека |

**Голосовые** → Whisper расшифровывает → GPT-4o классифицирует → AI отвечает.  
**Аудиофайлы** (созвоны) → транскрибация целиком → извлечение задач, ожиданий, решений.

## Локально

```bash
cd bot
cp .env.example .env  # заполни TELEGRAM_BOT_TOKEN и OPENAI_API_KEY
npm install
npm start
```

## Деплой на Railway

1. Создай бота:
   - Открой [@BotFather](https://t.me/BotFather) → `/newbot`
   - Имя: `LIFE OS` (или своё)
   - Username: `your_lifeos_bot`
   - Скопируй токен
2. Настрой Menu Button:
   - У того же BotFather → `/mybots` → выбери своего → **Bot Settings** → **Menu Button**
   - URL: `https://life-os-chi-rose.vercel.app`
   - Текст: `⚡ LIFE OS`
3. Деплой:
   - [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → `GeorgeTsikun/life-os`
   - **Settings** → **Root Directory** = `bot`
   - **Variables**:
     - `TELEGRAM_BOT_TOKEN` (от BotFather)
     - `OPENAI_API_KEY` (тот же что в Vercel)
     - `TELEGRAM_WEBAPP_URL` = `https://life-os-chi-rose.vercel.app`
     - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (опционально)
   - Railway автоматически запустит `npm install && npm start`
4. В Telegram напиши боту `/start` → проверь работу

## Ограничения текущей версии

- **Без Supabase** бот работает как умный расшифровщик и AI-собеседник, но не сохраняет данные в общую базу
- **Память чата в RAM** — `/chat` контекст теряется при рестарте Railway
- **Long polling** — переход на webhook планируется при росте нагрузки

## Архитектура

```
Telegram → grammy → классификатор GPT-4o-mini → действие
                                              ├→ Supabase (если подключён)
                                              └→ Ответ пользователю
```
