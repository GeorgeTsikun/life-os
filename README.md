# ⚡ LIFE OS

Персональная операционная система жизни с геймификацией.  
PWA + Telegram Mini App.

## Возможности

- **Дашборд** — уровень, XP, страйк, квесты дня, RPG-характеристики
- **Задачи** — матрица Эйзенхауэра (список + 2×2 вид), XP за выполнение
- **Здоровье** — кольца активности, сон, HRV, пульс + синхронизация Apple Health
- **Спорт** — трекер тренировок, недельная сетка, история
- **Питание** — вода, БАДы, макронутриенты, чекбоксы
- **Проекты** — выручка, прогресс, финансовые цели
- **Люди / CRM** — обязательства, дедлайны, история взаимодействий
- **Достижения** — 12 бейджей, RPG-стат лист, еженедельный челлендж

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | Vanilla JS ES-модули + Chart.js |
| База данных | Supabase (PostgreSQL + RLS) |
| Хостинг | Vercel (статика) |
| Бот | Railway (Telegram webhook) |
| Здоровье | iOS Shortcuts → Supabase Edge Function |

## Быстрый старт (локально)

```bash
cd life-os
python3 -m http.server 8000
# Открой http://localhost:8000
```

## Деплой

### 1. GitHub

```bash
cd life-os
git init
git add .
git commit -m "feat: первый запуск LIFE OS"
git remote add origin https://github.com/ВАШ_ЛОГИН/life-os.git
git push -u origin main
```

### 2. Supabase

1. Открой [app.supabase.com](https://app.supabase.com) → твой проект
2. SQL Editor → вставь содержимое `supabase/migrations/001_начальная_схема.sql` → Run
3. Settings → API → скопируй `Project URL` и `anon public key`

### 3. Vercel

```bash
# Установи Vercel CLI один раз
npm i -g vercel

# Из папки проекта
vercel

# Добавь переменные окружения
vercel env add SUPABASE_URL
vercel env add SUPABASE_KEY
```

Или через UI: vercel.com → проект → Settings → Environment Variables.

### 4. Apple Health (iOS Shortcuts)

Создай Shortcuts-автоматизацию (запуск каждое утро в 07:00):

1. **Получить** данные из Здоровья: Сон, ЧСС в покое, ВСР, Шаги, Калории
2. **URL**: `https://ВАШ_ПРОЕКТ.supabase.co/functions/v1/health-sync`
3. **Метод**: POST
4. **Заголовки**: `x-health-secret: ВАШ_СЕКРЕТ`
5. **Тело** (JSON):
```json
{
  "user_id": "ВАШ_UUID_ИЗ_SUPABASE",
  "sleep_h": [Часов сна],
  "hrv": [ВСР],
  "resting_hr": [ЧСС в покое],
  "steps": [Шаги],
  "calories": [Калории]
}
```

### 5. Telegram-бот (Railway)

Полноценный AI-бот живёт в папке [`bot/`](bot/) и деплоится на Railway отдельно от Mini App.

**Возможности:**
- Голосовые сообщения → Whisper → GPT-4o классифицирует (задача / идея / решение / чек-ин)
- Длительный AI-чат с памятью контекста
- Утренний брифинг, вечерний чек-ин
- Открывает Mini App кнопкой Web App
- Транскрибация созвонов целиком

**Подробная инструкция:** см. [bot/README.md](bot/README.md).

Кратко:
1. [@BotFather](https://t.me/BotFather) → `/newbot` → получи токен → задай Menu Button URL = `https://life-os-chi-rose.vercel.app`
2. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub** → `GeorgeTsikun/life-os`
3. **Settings** → **Root Directory** = `bot`
4. **Variables**: `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `TELEGRAM_WEBAPP_URL`

## Структура проекта

```
life-os/
├── index.html              # Оболочка приложения
├── manifest.json           # PWA-манифест
├── sw.js                   # Сервис-воркер (офлайн)
├── vercel.json             # Конфиг Vercel
├── css/
│   ├── base.css            # Токены, анимации, утилиты
│   ├── components.css      # Карточки, бейджи, кнопки
│   └── screens.css         # Стили экранов
├── js/
│   ├── app.js              # Главный модуль, навигация, тосты
│   ├── db.js               # Слой данных (localStorage + Supabase)
│   ├── gamification.js     # XP, уровни, страйки, достижения
│   ├── telegram.js         # Telegram Mini App SDK
│   └── screens/
│       ├── dash.js         # Дашборд
│       ├── tasks.js        # Задачи
│       ├── health.js       # Здоровье / Спорт / Питание
│       ├── projects.js     # Проекты
│       ├── people.js       # Люди / CRM
│       └── achievements.js # Достижения
└── supabase/
    ├── migrations/
    │   └── 001_начальная_схема.sql
    └── functions/
        └── health-sync/    # Edge Function для Apple Health
```

## Лицензия

MIT — делай что хочешь 🚀
