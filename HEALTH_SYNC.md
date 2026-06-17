# Apple Health → LIFE OS (iOS Shortcut)

Синхронизация шагов/сна/HRV/пульса из Apple Health в LIFE OS через серверный endpoint `/api/health-sync`.

## 1. Env на Vercel
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — уже должны быть.
- `HEALTH_SYNC_TOKEN` — задай любую длинную строку (секрет, чтобы посторонние не слали данные).

## 2. Shortcut (Команды) на iPhone
Создай команду «LIFE OS Health» и добавь автоматизацию **«Каждый день в 23:30»**:

1. **Find Health Samples** (несколько блоков «Найти образцы Здоровья»):
   - Шаги (Steps) → сумма за сегодня → переменная `steps`
   - Пульс покоя (Resting Heart Rate) → среднее → `restingHr`
   - Вариабельность пульса (HRV / SDNN) → среднее → `hrv`
   - Сон (Sleep Analysis) → часы → `sleep`
2. **Текст** → собери JSON:
   ```json
   {"steps":[steps],"restingHr":[restingHr],"hrv":[hrv],"sleep":[sleep]}
   ```
   (подставь переменные через выбор «Переменная»)
3. **Получить содержимое URL**:
   - URL: `https://life-os-chi-rose.vercel.app/api/health-sync`
   - Метод: **POST**
   - Заголовки: `x-health-token` = `<твой HEALTH_SYNC_TOKEN>`, `Content-Type` = `application/json`
   - Тело запроса: **Файл** → текст с JSON из шага 2

Готово — каждый вечер метрики прилетают в `health_metrics`, а приложение подтягивает их при следующем открытии (RC/энергия/дофамин считаются от реальных данных).

## Проверка вручную (curl)
```bash
curl -X POST 'https://life-os-chi-rose.vercel.app/api/health-sync' \
  -H 'x-health-token: ТОКЕН' -H 'Content-Type: application/json' \
  -d '{"steps":8420,"restingHr":58,"hrv":62,"sleep":7.4}'
# → {"ok":true,"date":"...","saved":4}
```

## Поля (любые можно слать, null не затирает)
`hrv · restingHr · sleep · sleepQuality · deep · rem · steps · calories · km · move · exercise · stand` (+ `date` опционально, иначе сегодня по Москве).
