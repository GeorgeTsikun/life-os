// ── LIFE OS — Telegram-бот ────────────────────────────────────────────────────
// Запускается на Railway, подключается к OpenAI и Supabase.
// Голосовые → Whisper → GPT-4o → структурирует и (когда Supabase активен) сохраняет.

import 'dotenv/config';
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as Notion from './notion.js';
import * as GCal from './google.js';
import { запуститьРасписание, зарегистрироватьОбработчики, утреннийАвтоБрифинг, отправитьКарточкуПереноса } from './scheduling.js';
import { отправитьОтчёт, отправитьДашборд, отправитьКанбан, отправитьПланДня, отправитьОтчётЗаДень } from './reports.js';
import { начатьДекомпозицию, зарегистрироватьДекомпозицию, перехватитьПравку, ждётПравку } from './decompose.js';

// ── КОНФИГ ────────────────────────────────────────────────────────────────────
const TOKEN           = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TG_ID     = process.env.OWNER_TELEGRAM_ID || '';
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const WEBAPP_BASE   = process.env.TELEGRAM_WEBAPP_URL || 'https://life-os-chi-rose.vercel.app';
// Каждая кнопка с уникальным URL — обход кэша Telegram WebApp
const безКэша = (доп = '') => {
  const сеп = доп.includes('?') ? '&' : (доп ? '?' : '?');
  return `${WEBAPP_BASE}${доп}${сеп}t=${Date.now()}`;
};
const SUPABASE_URL  = process.env.SUPABASE_URL  || '';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!TOKEN)      throw new Error('TELEGRAM_BOT_TOKEN не задан');
if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY не задан');

const bot    = new Bot(TOKEN);
const openai = new OpenAI({ apiKey: OPENAI_KEY });
const supa   = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const ПАМЯТЬ_ЧАТА = new Map(); // userId → массив последних сообщений (для контекста)

// ── СИСТЕМНЫЙ ПРОМТ AI-ДИРЕКТОРА ──────────────────────────────────────────────
const ДИРЕКТОР_ПРОМТ = `Ты — персональный AI-директор Джорджа в Telegram.

ПРАВИЛА:
- Говоришь прямо, без воды, без льстивых вступлений
- Если что-то идёт не так — говоришь
- Если цели противоречат — указываешь
- Ответы короткие, максимум 4-5 предложений если не просили развёрнуто
- Всё на русском, эмодзи уместно
- Используешь Markdown (*жирный*, _курсив_) для важного`;

// Дата по Москве (UTC+3) со сдвигом на n дней — для опорных дат классификатора
const ДАТА_МСК = (сдвигДней = 0) =>
  new Date(Date.now() + 3 * 3600 * 1000 + сдвигДней * 86400000).toISOString().split('T')[0];
const ТЕКУЩАЯ_ДАТА = () => ДАТА_МСК(0); // YYYY-MM-DD по Москве

const КЛАССИФИКАТОР_ПРОМТ = `Сегодня ${ТЕКУЩАЯ_ДАТА()}. Часовой пояс пользователя: Москва (UTC+3).

📌 ОПОРНЫЕ ДАТЫ (Москва) — БЕРИ ОТСЮДА, НЕ ВЫЧИСЛЯЙ САМ:
- сегодня      = ${ДАТА_МСК(0)}
- завтра       = ${ДАТА_МСК(1)}
- послезавтра  = ${ДАТА_МСК(2)}
Для start_iso всегда подставляй дату ТОЧНО из этого списка. «завтра в 14» → "${ДАТА_МСК(1)}T14:00:00".

Ты классифицируешь сообщения пользователя в систему персональной ОС жизни.

ТИПЫ (выбери ОДИН):
- task          — действие которое ПОЛЬЗОВАТЕЛЬ должен сделать сам
- waiting       — пользователь ЖДЁТ что-то от другого человека
- idea          — мысль/идея для будущего (НЕ контентная — иначе content_idea)
- content_idea  — идея для блога/контента: рилс, карусель, тред, видео, пост, шортс, статья
- checkin       — вечерний отчёт «что сделал сегодня»
- meeting_notes — транскрибация целого созвона или встречи (длинный текст)
- decision      — важное решение «решил сделать X потому что Y»
- question      — вопрос/просьба к директору
- mood          — описание состояния/самочувствия
- report_request — пользователь ПРОСИТ показать сводку/отчёт или разбить задачу

📑 report_request — триггеры и поле "kind":
  • «дашборд», «покажи статы», «мой прогресс», «уровень/XP» → kind="dashboard"
  • «канбан», «доска», «покажи задачи по колонкам», «что в работе» → kind="kanban"
  • «план дня», «что у меня на сегодня», «расписание на сегодня» → kind="plan"
  • «итоги дня», «итог дня», «что я сделал сегодня», «отчёт за день» → kind="day_report"
  • «разбей задачу X», «декомпозируй X», «раздели на шаги X» → kind="decompose", и в поле "text" положи саму задачу X
  Поля report_request: {"kind":"...", "text":"<только для decompose>"}

🎬 ОПРЕДЕЛЕНИЕ content_idea (важно отличать от обычных idea/task):
Триггеры — слова про контент-производство:
  • «рилс / reel / reels»  • «карусель / карусели»  • «сторис»  • «шортс / short»
  • «видео для», «видео про», «снять видео»  • «пост для / в»  • «тред / treads»
  • «контент про», «идея для блога», «идея для инсты», «для ютуба»
  • «статья», «дзен», «тикток»

ПОЛЯ content_idea:
  • title       — короткий заголовок идеи
  • text        — расширенное описание / тезисы / сценарий если есть
  • platforms   — массив платформ. ВЫБИРАЙ из:
      "instagram", "threads", "youtube", "telegram", "tiktok", "dzen"
      По умолчанию (если не указано):
        — рилс/карусель/сторис → ["instagram"]
        — шортс → ["youtube"]
        — тред → ["threads"]
        — пост без указания → ["telegram"]
        — видео длинное → ["youtube"]
        — статья → ["dzen"]
      Если упомянуто несколько — все.
  • content_type — один из:
      "reel" (рилс), "carousel" (карусель), "story" (сторис), "post" (пост),
      "short" (шортс), "longvideo" (длинное видео), "live" (эфир),
      "thread" (тред), "article" (статья), "videomsg" (видеосообщ.)

🔑 ЖЁСТКИЕ ПРАВИЛА (нарушать нельзя):

1. Слова «надо», «нужно», «должен», «мне сделать», «созвон», «созвониться», «позвонить», «встреча с», «отправить» = task. Это ВСЕГДА действие пользователя.

2. waiting ТОЛЬКО когда явно сказано: «жду от X», «X должен прислать», «X обещал», «ждём от X». Без явного «жду / от X» = НЕ waiting.

3. Слова важности/срочности в task мапятся в quadrant:
   • «важно срочно» / «срочно важно» / горящий дедлайн → quadrant = "do"
   • «важно не срочно» / стратегическая цель / развитие → quadrant = "schedule"
   • БЫТОВАЯ МЕХАНИКА (мусор, посуда, постирать, душ, перезвонить, мелкие покупки) → quadrant = "delegate" (это РУТИНА)
   • «не важно не срочно», ловушка времени, скролл, прокрастинация → quadrant = "eliminate"
   • если неясно — quadrant = "schedule"

4. Упоминание чьего-то имени в задаче (созвон с CTO, встреча с Димой) НЕ делает её waiting. Это всё ещё твоя задача — провести встречу.

5. ОБЯЗАТЕЛЬНО заполни поле "cat" одной из этих 11 категорий (это области жизни):
   • "Работа"        — рабочие задачи, клиенты, контроль, deliverables
   • "Контент"       — рилсы, посты, сценарии, съёмки
   • "Эксперименты"  — новые продукты, фичи, тех-разработка, своё приложение
   • "Семья"         — Таня, мама, близкие, друзья личные
   • "Встречи"       — созвоны, нетворкинг, мастермайнд (онлайн + офлайн)
   • "Быт"           — еда, спорт, дом, мелкие покупки, машина, гараж, душ
   • "Стратегия"     — планирование, рефлексия, обзоры, видение
   • "Обучение"      — курсы, книги, разборы, рост навыков
   • "Деньги"        — кредитки, платежи, поиск финансирования, налоги
   • "Здоровье"      — врачи, чекапы, БАДы, лечение
   • "Chill"         — отдых ради восстановления, не баловство

⚠️ ВАЖНО: одно сообщение может содержать НЕСКОЛЬКО задач/идей/событий.
Если в сообщении больше одной штуки — раздели их. Например:
«Купить творог завтра и провести встречу в 14 с Димой» = ДВА item'а
(task: купить творог, task: встреча с Димой 14:00).

Возвращай ВСЕГДА массив items, даже если он один:
{
  "items": [
    {"тип": "...", "извлечено": {...}, "ответ_пользователю": "..."},
    ...
  ]
}

📅 ВРЕМЯ В ISO ФОРМАТЕ (важно для календаря):
Для task — если упомянуто время или дата, ДОБАВЬ поле "start_iso" в ISO 8601:
   • «завтра в 14» → start_iso: "${(() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })()}T14:00:00"
   • «через час» → текущее время + 1 час
   • «в пятницу утром» → ближайшая пятница T09:00:00
   • «10 июля» → "2026-07-10T09:00:00" (без времени — ставь 09:00)
   • если время не указано совсем — start_iso опускай
Также добавь "duration_min" если известна длительность (по умолчанию 60).

ПРИМЕРЫ (учись на них):

Вход: «Завтра в 14 созвон с Димой, важно срочно, надо определиться с планом блога»
→ {"тип":"task","извлечено":{"quadrant":"do","text":"Созвон с Димой — определиться с планом блога","time":"завтра 14:00","start_iso":"${(() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })()}T14:00:00","duration_min":60,"cat":"Бизнес"}}

Вход: «Жду от Димы архитектуру VAIB до пятницы»
→ {"тип":"waiting","извлечено":{"name":"Дима","what":"архитектура VAIB","due":"пятница"}}

Вход: «Идея: сделать рассылку с разборами кейсов»
→ {"тип":"idea","извлечено":{"text":"Рассылка с разборами кейсов"}}

Вход: «Решил закрыть Smart Stylist — нет фокуса»
→ {"тип":"decision","извлечено":{"text":"Закрыть Smart Stylist","контекст":"нет фокуса"}}

Вход: «Идея для рилса: 5 ошибок при найме команды»
→ {"тип":"content_idea","извлечено":{"title":"5 ошибок при найме команды","platforms":["instagram"],"content_type":"reel"}}

Вход: «Сделать карусель про матрицу Эйзенхауэра для инсты и тредов»
→ {"тип":"content_idea","извлечено":{"title":"Матрица Эйзенхауэра","platforms":["instagram","threads"],"content_type":"carousel"}}

Вход: «Хочу снять видео для ютуба про свой стартап»
→ {"тип":"content_idea","извлечено":{"title":"Про свой стартап","platforms":["youtube"],"content_type":"longvideo"}}

Верни ТОЛЬКО валидный JSON со СПИСКОМ items (даже если он один):
{
  "items": [
    {
      "тип": "...",
      "уверенность": 0-100,
      "извлечено": { ... поля из примеров выше ... },
      "ответ_пользователю": "1-2 короткие фразы. Без льстивых вводных, без 'отлично!', 'понял!'."
    }
  ]
}`;

// ── /start ────────────────────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const имя = ctx.from?.first_name || 'друг';
  const клавиатура = new InlineKeyboard()
    .webApp('⚡ Открыть LIFE OS', безКэша()).row()
    .text('📊 Дашборд', 'rep:dashboard')
    .text('📋 Канбан', 'rep:kanban').row()
    .text('🗓 План дня', 'rep:plan')
    .text('📈 Итог дня', 'rep:report').row()
    .text('📅 План на сегодня', 'today')
    .text('🌙 Вечерний чек-ин', 'evening');

  await ctx.reply(
    `*${имя}, добро пожаловать в LIFE OS* 👑\n\n` +
    `Я твой персональный AI-директор.\n\n` +
    `Просто говори со мной голосом или текстом:\n` +
    `• 🎙️ Запиши голосовое — я расшифрую и пойму что это (задача, идея, решение)\n` +
    `• 💬 Напиши вопрос — отвечу с учётом твоего контекста\n\n` +
    `*Отчёты:*\n` +
    `• /dashboard — дашборд · /kanban — доска\n` +
    `• /plan — план дня · /report — итог дня\n` +
    `• /decompose <задача> — разбить на шаги\n\n` +
    `• /today — брифинг · /summary — чек-ин · /chat — разговор\n` +
    `_Можно и просто словами: «покажи канбан», «план на сегодня»._`,
    { parse_mode: 'Markdown', reply_markup: клавиатура }
  );
});

// ── /today ────────────────────────────────────────────────────────────────────
bot.command('today', async (ctx) => {
  await ctx.replyWithChatAction('typing');
  await утреннийАвтоБрифинг({
    bot,
    supa,
    openai,
    ownerTgId: ctx.from.id.toString(),
    безКэша,
    ДИРЕКТОР_ПРОМТ,
  });
});
bot.callbackQuery('today', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.replyWithChatAction('typing');
  await утреннийАвтоБрифинг({
    bot,
    supa,
    openai,
    ownerTgId: ctx.from.id.toString(),
    безКэша,
    ДИРЕКТОР_ПРОМТ,
  });
});

// ── ОТЧЁТЫ (дашборд / канбан / план дня / итог дня) ───────────────────────────
function отчётDeps(ctx) {
  return { bot, supa, openai, chatId: ctx.from.id, безКэша, ДИРЕКТОР_ПРОМТ };
}

bot.command('dashboard', async (ctx) => { await ctx.replyWithChatAction('typing'); await отправитьДашборд(отчётDeps(ctx)); });
bot.command('kanban',    async (ctx) => { await ctx.replyWithChatAction('typing'); await отправитьКанбан(отчётDeps(ctx)); });
bot.command('plan',      async (ctx) => { await ctx.replyWithChatAction('typing'); await отправитьПланДня(отчётDeps(ctx)); });
bot.command('report',    async (ctx) => { await ctx.replyWithChatAction('typing'); await отправитьОтчётЗаДень(отчётDeps(ctx)); });

bot.callbackQuery(/^rep:(dashboard|kanban|plan|report)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.replyWithChatAction('typing');
  await отправитьОтчёт(ctx.match[1], отчётDeps(ctx)).catch(e => console.warn('[rep]', e.message));
});

// ── /decompose — разбить задачу на подзадачи ──────────────────────────────────
bot.command('decompose', async (ctx) => {
  await начатьДекомпозицию(ctx, { openai, supa }, ctx.match?.trim());
});

// ── /summary — вечерний чек-ин ────────────────────────────────────────────────
bot.command('summary', async (ctx) => {
  await ctx.reply(
    '🌙 *Вечерний чек-ин*\n\nРасскажи голосом или текстом что сегодня сделал, что не успел, как энергия.\n\nЯ обновлю задачи, начислю XP и зафиксирую решения.',
    { parse_mode: 'Markdown' }
  );
  ПАМЯТЬ_ЧАТА.set(ctx.from.id, [{ режим: 'checkin' }]);
});
bot.callbackQuery('evening', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🌙 Рассказывай! Голосом или текстом — как прошёл день?');
  ПАМЯТЬ_ЧАТА.set(ctx.from.id, [{ режим: 'checkin' }]);
});

// ── ПЕРЕМЕЩЕНИЕ ЗАДАЧИ В ДРУГОЙ КВАДРАНТ ─────────────────────────────────────
bot.callbackQuery(/^move:(do|schedule|delegate|eliminate)$/, async (ctx) => {
  const квадрант = ctx.match[1];
  const ярлыки = {
    do:        '⚡ ШТУРМ (важно · срочно)',
    schedule:  '🏔️ РОСТ (двигает к цели)',
    delegate:  '⚙️ РУТИНА (бытовая механика)',
    eliminate: '🌀 ЛОВУШКА (ворует время)',
  };
  await ctx.answerCallbackQuery({ text: 'Перемещаю…' });

  if (!supa) {
    return ctx.answerCallbackQuery({ text: '⚠️ Supabase не подключён', show_alert: true });
  }

  try {
    // Берём последнюю задачу пользователя и обновляем её квадрант
    const { data: задачи } = await supa.from('tasks')
      .select('id').eq('owner', 'george').order('created_at', { ascending: false }).limit(1);
    if (!задачи?.length) {
      return ctx.reply('❌ Не нашёл недавнюю задачу для перемещения');
    }
    const xp = {do:75,schedule:50,delegate:25,eliminate:25}[квадрант];
    const { error } = await supa.from('tasks')
      .update({ quadrant: квадрант, xp_value: xp })
      .eq('id', задачи[0].id);
    if (error) throw new Error(error.message);

    await ctx.reply(`✓ Перемещено: *${ярлыки[квадрант]}*\n_Открой Mini App чтобы увидеть_`, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`⚠️ Не удалось переместить: ${err.message}`);
  }
});

// ── 🧩 РАЗБИТЬ ПОСЛЕДНЮЮ ЗАДАЧУ НА ПОДЗАДАЧИ ──────────────────────────────────
bot.callbackQuery('dec:last', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!supa) return ctx.reply('⚠️ Supabase не подключён');
  const { data } = await supa.from('tasks')
    .select('id,text').eq('owner', 'george')
    .order('created_at', { ascending: false }).limit(1);
  if (!data?.length) return ctx.reply('❌ Не нашёл задачу для разбивки');
  await начатьДекомпозицию(ctx, { openai, supa }, { taskId: data[0].id, text: data[0].text });
});

// ── /chat — режим разговора ───────────────────────────────────────────────────
bot.command('chat', async (ctx) => {
  ПАМЯТЬ_ЧАТА.set(ctx.from.id, []);
  await ctx.reply('💬 *Режим разговора активен*\n\nПиши что угодно — я держу контекст всей беседы. /reset чтобы очистить.', { parse_mode: 'Markdown' });
});

bot.command('reset', async (ctx) => {
  ПАМЯТЬ_ЧАТА.delete(ctx.from.id);
  await ctx.reply('🧹 Контекст очищен.');
});

// ── /add — задача через текст ─────────────────────────────────────────────────
bot.command('add', async (ctx) => {
  const текст = ctx.match?.trim();
  if (!текст) {
    return ctx.reply('Использование: `/add Позвонить маме сегодня`', { parse_mode: 'Markdown' });
  }
  await обработатьВход(ctx, текст, { принудительныйТип: 'task' });
});

// ── /note — идея в банк ───────────────────────────────────────────────────────
bot.command('note', async (ctx) => {
  const текст = ctx.match?.trim();
  if (!текст) return ctx.reply('Использование: `/note Сделать функцию X`', { parse_mode: 'Markdown' });
  await обработатьВход(ctx, текст, { принудительныйТип: 'idea' });
});

// ── /wait — ожидание ──────────────────────────────────────────────────────────
bot.command('wait', async (ctx) => {
  const текст = ctx.match?.trim();
  if (!текст) return ctx.reply('Использование: `/wait Дима пришлёт архитектуру до пятницы`', { parse_mode: 'Markdown' });
  await обработатьВход(ctx, текст, { принудительныйТип: 'waiting' });
});

// ── ГОЛОСОВЫЕ СООБЩЕНИЯ ───────────────────────────────────────────────────────
bot.on('message:voice', async (ctx) => {
  await ctx.replyWithChatAction('typing');
  try {
    const файл  = await ctx.getFile();
    const url   = `https://api.telegram.org/file/bot${TOKEN}/${файл.file_path}`;
    const ответ = await fetch(url);
    const буфер = Buffer.from(await ответ.arrayBuffer());

    const file = new File([буфер], 'voice.ogg', { type: 'audio/ogg' });
    const рез  = await openai.audio.transcriptions.create({
      file, model: 'whisper-1', language: 'ru',
    });

    await ctx.reply(`🎙️ _Расшифровано:_\n${рез.text}`, { parse_mode: 'Markdown' });
    if (ждётПравку(ctx.from.id) && await перехватитьПравку(ctx, рез.text, { openai, supa })) return;
    if (ПОСЛЕДНЕЕ_БЛЮДО.has(ctx.from.id) && await уточнитьБлюдо(ctx, рез.text)) return;
    await обработатьВход(ctx, рез.text);
  } catch (err) {
    console.error('voice error:', err);
    await ctx.reply(`❌ Ошибка расшифровки: ${err.message}`);
  }
});

// ── АУДИО ФАЙЛЫ (транскрибация созвонов) ──────────────────────────────────────
bot.on('message:audio', async (ctx) => {
  await ctx.reply('🎙️ Принял аудио. Расшифровываю созвон (это может занять минуту)…');
  await ctx.replyWithChatAction('typing');
  try {
    const файл  = await ctx.getFile();
    const url   = `https://api.telegram.org/file/bot${TOKEN}/${файл.file_path}`;
    const ответ = await fetch(url);
    const буфер = Buffer.from(await ответ.arrayBuffer());

    const file = new File([буфер], 'audio.mp3', { type: ctx.message.audio.mime_type || 'audio/mpeg' });
    const рез  = await openai.audio.transcriptions.create({
      file, model: 'whisper-1', language: 'ru',
    });

    // Сохраним длинный транскрипт куском
    if (рез.text.length > 3500) {
      await ctx.reply(`📝 *Транскрипт (часть 1):*\n${рез.text.slice(0,3500)}`, { parse_mode: 'Markdown' });
      await ctx.reply(`*(часть 2):*\n${рез.text.slice(3500)}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`📝 *Транскрипт:*\n${рез.text}`, { parse_mode: 'Markdown' });
    }

    await обработатьВход(ctx, рез.text, { принудительныйТип: 'meeting_notes' });
  } catch (err) {
    await ctx.reply(`❌ Ошибка: ${err.message}`);
  }
});

// ── ФОТО ЕДЫ → GPT-4o Vision → КБЖУ → Supabase meals ──────────────────────────
const FOOD_VISION_PROMPT = `Ты нутрициолог. Оцени блюдо на фото. Верни ТОЛЬКО JSON без markdown:
{"name":"...","calories":000,"protein":00,"fat":00,"carbs":00,"weight_g":000,"items":[{"name":"...","calories":00}],"health_score":0,"confidence":"high|medium|low","note":"1 строка"}
calories в ккал, остальное в граммах; health_score 1-10; если еды нет — {"error":"Еда не найдена"}.`;

// Контекст последнего блюда на пользователя — для текстовых/голосовых уточнений
const ПОСЛЕДНЕЕ_БЛЮДО = new Map(); // userId → { mealId, ts, prev }

// Карточка блюда (используется и при фото, и при уточнении)
function карточкаБлюда(data, сохранено) {
  const ингр = Array.isArray(data.items) && data.items.length
    ? '\n' + data.items.map(i => `• ${i.name}${i.calories ? ` — ${i.calories} ккал` : ''}`).join('\n') : '';
  const hs = data.health_score ? `\n❤️ Польза: *${data.health_score}/10*` : '';
  return `🍽️ *${data.name || 'Блюдо'}*\n\n` +
    `🔥 *${data.calories || 0} ккал* · Б ${data.protein || 0} · Ж ${data.fat || 0} · У ${data.carbs || 0}${hs}${ингр}\n\n` +
    (data.note ? `_${data.note}_\n\n` : '') +
    (сохранено ? '_✓ записано · видно в Mini App_\n✏️ _Не угадал? Ответь текстом или голосом, что это — пересчитаю._' : '_⚠️ не сохранено в облако_');
}

// Уточнить блюдо текстом: пересчитать КБЖУ и обновить запись в Supabase
async function уточнитьБлюдо(ctx, текст) {
  const userId = ctx.from.id;
  const ctxБлюдо = ПОСЛЕДНЕЕ_БЛЮДО.get(userId);
  if (!ctxБлюдо || Date.now() - ctxБлюдо.ts > 15 * 60 * 1000) { ПОСЛЕДНЕЕ_БЛЮДО.delete(userId); return false; }

  await ctx.replyWithChatAction('typing');
  try {
    const prev = ctxБлюдо.prev || {};
    const completion = await openai.chat.completions.create({
      model: process.env.FOOD_MODEL || 'gpt-4o',
      max_tokens: 500,
      messages: [{ role: 'user', content:
        `${FOOD_VISION_PROMPT}\n\nИИ ранее распознал блюдо как: "${prev.name || '?'}" (${prev.calories || 0} ккал). ` +
        `Пользователь уточняет, что на самом деле это: "${текст}". Пересчитай КБЖУ по уточнению.` }],
    });
    const raw = completion.choices[0].message.content || '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('не распознал');
    const data = JSON.parse(m[0]);
    if (data.error) { await ctx.reply(`🤷 ${data.error}`); return true; }

    let сохранено = false;
    if (supa) {
      const { error } = await supa.from('meals').update({
        name: data.name || prev.name, items: data.items || [],
        calories: data.calories || 0, protein: data.protein || 0, fat: data.fat || 0, carbs: data.carbs || 0,
        weight_g: data.weight_g || null, health_score: data.health_score || null, note: data.note || null,
      }).eq('id', ctxБлюдо.mealId);
      сохранено = !error;
      if (error) console.error('[meal update]', error.message);
    }
    // обновляем контекст на случай повторного уточнения
    ПОСЛЕДНЕЕ_БЛЮДО.set(userId, { mealId: ctxБлюдо.mealId, ts: Date.now(), prev: data });
    await ctx.reply('✏️ *Пересчитал:*\n\n' + карточкаБлюда(data, сохранено),
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().webApp('🥗 Открыть питание', безКэша('?tab=health')) });
    return true;
  } catch (err) {
    console.error('уточнить блюдо:', err);
    await ctx.reply(`❌ Не смог пересчитать: ${err.message}`);
    return true;
  }
}

bot.on('message:photo', async (ctx) => {
  await ctx.replyWithChatAction('typing');
  try {
    // Берём самое большое изображение
    const photos = ctx.message.photo;
    const big = photos[photos.length - 1];
    const файл = await ctx.api.getFile(big.file_id);
    const url = `https://api.telegram.org/file/bot${TOKEN}/${файл.file_path}`;
    const resp = await fetch(url);
    const b64 = Buffer.from(await resp.arrayBuffer()).toString('base64');

    const completion = await openai.chat.completions.create({
      model: process.env.FOOD_MODEL || 'gpt-4o',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
          { type: 'text', text: FOOD_VISION_PROMPT },
        ],
      }],
    });
    const raw = completion.choices[0].message.content || '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('не распознал ответ');
    const data = JSON.parse(m[0]);
    if (data.error) return ctx.reply(`🤷 ${data.error}`);

    // Сохраняем в Supabase → появится в Mini App
    let сохранено = false, mealId = null;
    if (supa) {
      const сегодня = new Date(Date.now() + 3*3600*1000).toISOString().split('T')[0];
      const время = new Date(Date.now() + 3*3600*1000).toISOString().slice(11,16);
      const { data: ins, error } = await supa.from('meals').insert({
        owner: 'george', date: сегодня, time_label: время,
        meal_type: автоТипПриёма(),
        name: data.name || 'Блюдо', items: data.items || [],
        calories: data.calories||0, protein: data.protein||0, fat: data.fat||0, carbs: data.carbs||0,
        weight_g: data.weight_g||null, health_score: data.health_score||null, note: data.note||null,
      }).select();
      сохранено = !error;
      mealId = ins?.[0]?.id || null;
      if (error) console.error('[meal insert]', error.message);
    }

    // Запоминаем блюдо — следующее текст/голос станет уточнением
    if (mealId) ПОСЛЕДНЕЕ_БЛЮДО.set(ctx.from.id, { mealId, ts: Date.now(), prev: data });

    await ctx.reply(карточкаБлюда(data, сохранено),
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().webApp('🥗 Открыть питание', безКэша('?tab=health')) });
  } catch (err) {
    console.error('food photo:', err);
    await ctx.reply(`❌ Ошибка анализа фото: ${err.message}`);
  }
});

function автоТипПриёма() {
  const h = new Date(Date.now() + 3*3600*1000).getUTCHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// ── ТЕКСТОВЫЕ СООБЩЕНИЯ ───────────────────────────────────────────────────────
bot.on('message:text', async (ctx) => {
  const сообщ = ctx.message.text;
  if (сообщ.startsWith('/')) return; // команды обрабатываются выше

  // Если ждём правку декомпозиции — перенаправляем туда
  if (ждётПравку(ctx.from.id)) {
    if (await перехватитьПравку(ctx, сообщ, { openai, supa })) return;
  }

  // Недавно было фото еды → этот текст = уточнение блюда (пересчёт КБЖУ)
  if (ПОСЛЕДНЕЕ_БЛЮДО.has(ctx.from.id)) {
    if (await уточнитьБлюдо(ctx, сообщ)) return;
  }

  // Если активен режим chat — просто отвечаем как директор
  const память = ПАМЯТЬ_ЧАТА.get(ctx.from.id);
  if (память && Array.isArray(память) && !память[0]?.режим) {
    return разговор(ctx, сообщ);
  }

  // Иначе пробуем классифицировать
  await обработатьВход(ctx, сообщ);
});

// ── ОБЩАЯ ОБРАБОТКА ВХОДА (голос/текст) ───────────────────────────────────────
async function обработатьВход(ctx, текст, opts = {}) {
  try {
    await ctx.replyWithChatAction('typing');

    const сообщения = [
      { role: 'system', content: КЛАССИФИКАТОР_ПРОМТ },
      { role: 'user',   content: текст },
    ];
    if (opts.принудительныйТип) {
      сообщения.push({ role: 'system', content: `Тип принудительно: "${opts.принудительныйТип}". Просто извлеки данные.` });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: сообщения,
      temperature: 0.3,
    });

    const полныйРазбор = JSON.parse(completion.choices[0].message.content);
    // Поддержка обоих форматов: массив items (новый) или один объект (legacy)
    const items = Array.isArray(полныйРазбор.items) ? полныйРазбор.items
                : полныйРазбор.тип ? [полныйРазбор]
                : [];

    if (items.length === 0) {
      return ctx.reply('🤷 Ничего не извлёк. Попробуй сказать конкретнее.');
    }

    if (items.length > 1) {
      await ctx.reply(`📥 Нашёл *${items.length}* пунктов в сообщении — обрабатываю по очереди:`,
        { parse_mode: 'Markdown' });
    }

    // Обрабатываем каждый item отдельной карточкой
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      // Запросы отчётов/декомпозиции не сохраняем как задачи, а выполняем
      if (it.тип === 'report_request') {
        const kind = it.извлечено?.kind || it.kind;
        if (kind === 'decompose') {
          await начатьДекомпозицию(ctx, { openai, supa }, it.извлечено?.text || текст);
        } else {
          await отправитьОтчёт(kind, отчётDeps(ctx)).catch(e => console.warn('[rep text]', e.message));
        }
        continue;
      }
      await отправитьКарточкуРазбора(ctx, it, текст, i + 1, items.length);
    }

  } catch (err) {
    console.error('обработать вход:', err);
    await ctx.reply(`⚠️ ${err.message}`);
  }
}

// ── ОТПРАВКА ОДНОЙ КАРТОЧКИ РАЗБОРА ─────────────────────────────────────────
const ЯРЛЫКИ_ТИПОВ = {
  task:'📋 Задача', waiting:'⏳ Ожидание', idea:'💡 Идея',
  content_idea:'🎬 Контент-идея',
  checkin:'🌙 Чек-ин', meeting_notes:'📝 Заметки встречи',
  decision:'🔑 Решение', question:'❓ Вопрос', mood:'⚡ Состояние'
};

const ЯРЛЫКИ_КВАДРАНТОВ = {
  do:        '⚡ ШТУРМ (важно · срочно)',
  schedule:  '🏔️ РОСТ (двигает к цели)',
  delegate:  '⚙️ РУТИНА (бытовая механика)',
  eliminate: '🌀 ЛОВУШКА (ворует время)',
};

async function отправитьКарточкуРазбора(ctx, разбор, исходный, номер, всего) {
  const ярлык = ЯРЛЫКИ_ТИПОВ[разбор.тип] || '📌 Запись';

  let сохранён = false;
  if (supa) сохранён = await сохранитьВSupabase(ctx.from.id.toString(), разбор);

  let notionРезульт = { записал: null, база: null };
  if (Notion.notionАктивен()) {
    notionРезульт = await Notion.сохранитьВNotion(разбор, исходный, 'telegram');
  }

  const клавиатура = new InlineKeyboard();
  if (разбор.тип === 'task') {
    клавиатура
      .text('⚡ Штурм',    'move:do')
      .text('🏔️ Рост',     'move:schedule').row()
      .text('⚙️ Рутина',   'move:delegate')
      .text('🌀 Ловушка',  'move:eliminate').row()
      .text('🧩 Разбить на шаги', 'dec:last').row();
    // Если событие УЖЕ автоматически создано (OAuth настроен) — кнопка "Открыть событие"
    // Иначе fallback: открыть Google Calendar с заполненной формой
    if (разбор.gcal_link) {
      клавиатура.url('📅 Открыть событие', разбор.gcal_link).row();
    } else {
      const gcalUrl = генерироватьGcalUrl(разбор.извлечено);
      if (gcalUrl) клавиатура.url('📅 В Google Calendar', gcalUrl).row();
    }
  }
  if (разбор.тип === 'content_idea') {
    клавиатура.webApp('🎬 Открыть Контент', безКэша('?tab=content')).row();
  } else {
    клавиатура.webApp('🔍 Открыть в приложении', безКэша());
  }

  const извлечено = JSON.stringify(разбор.извлечено, null, 2);
  const notionСтрока = notionРезульт.записал
    ? `\n_📓 Записано в Notion → ${notionРезульт.база}_`
    : '';
  const gcalСтрока = разбор.gcal_calendar
    ? `\n_📅 Событие создано в → ${разбор.gcal_calendar}_`
    : '';
  const подпись = (сохранён
    ? '_✓ сохранено в облако · видно в Mini App_'
    : (supa
        ? '_⚠️ Supabase не сохранил_'
        : '_ℹ️ Supabase не подключён._')
  ) + notionСтрока + gcalСтрока;

  const квадрантПодсказка = (разбор.тип === 'task' && разбор.извлечено?.quadrant)
    ? `\n*Категория:* ${ЯРЛЫКИ_КВАДРАНТОВ[разбор.извлечено.quadrant] || разбор.извлечено.quadrant}\n_Если AI ошибся — жми правильную кнопку ниже._\n`
    : '';

  const префикс = всего > 1 ? `*[${номер}/${всего}]* ` : '';

  await ctx.reply(
    `${префикс}${ярлык}\n\n${разбор.ответ_пользователю || ''}\n\n` +
    `\`\`\`json\n${извлечено}\n\`\`\`` + квадрантПодсказка + '\n' + подпись,
    { parse_mode: 'Markdown', reply_markup: клавиатура }
  );
}

// ── РАЗГОВОР С AI-ДИРЕКТОРОМ ──────────────────────────────────────────────────
async function разговор(ctx, текст) {
  await ctx.replyWithChatAction('typing');
  const userId   = ctx.from.id.toString();
  const память   = ПАМЯТЬ_ЧАТА.get(userId) || [];
  const контекст = await загрузитьКонтекст(userId);

  память.push({ role: 'user', content: текст });
  if (память.length > 12) память.shift(); // храним последние 12 реплик

  const ответ = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: ДИРЕКТОР_ПРОМТ },
      { role: 'system', content: `Контекст пользователя:\n${JSON.stringify(контекст, null, 2)}` },
      ...память,
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const текстОтвета = ответ.choices[0].message.content;
  память.push({ role: 'assistant', content: текстОтвета });
  ПАМЯТЬ_ЧАТА.set(userId, память);

  await ctx.reply(текстОтвета, { parse_mode: 'Markdown' });
}

// ── ЗАГРУЗКА КОНТЕКСТА ИЗ SUPABASE ────────────────────────────────────────────
// Single-user версия: всё под owner='george'
async function загрузитьКонтекст(telegramId) {
  if (!supa) return { подсказка: 'Supabase не подключён' };

  try {
    const [{ data: задачи }, { data: проф }, { data: проекты }, { data: ожидания }] = await Promise.all([
      supa.from('tasks').select('text,quadrant,done').eq('owner', 'george').limit(30),
      supa.from('profile').select('xp,level,streak,name').eq('owner', 'george').maybeSingle(),
      supa.from('projects').select('name,progress,current,target,stage').eq('owner', 'george'),
      supa.from('waitings').select('what,person_name,due_date,context').eq('owner', 'george').eq('status', 'waiting').limit(10),
    ]);

    return {
      профиль: проф,
      открытых_задач: задачи?.filter(t => !t.done).length || 0,
      срочные: задачи?.filter(t => !t.done && t.quadrant === 'do').map(t => t.text).slice(0, 5) || [],
      проекты: проекты?.map(p => `${p.name} (${p.progress}%, ${p.stage})`),
      жду: ожидания?.map(w => `${w.what} от ${w.person_name || 'кого-то'} до ${w.due_date || '?'}`),
    };
  } catch (err) {
    console.error('загрузить контекст:', err);
    return {};
  }
}

// ── СОХРАНЕНИЕ В SUPABASE ─────────────────────────────────────────────────────
async function сохранитьВSupabase(telegramId, разбор) {
  if (!supa) {
    console.log('[supa] клиент не инициализирован');
    return false;
  }
  const извл = разбор.извлечено || {};
  try {
    // Запись в inbox для всех типов — для лога
    const inboxРезульт = await supa.from('inbox').insert({
      owner: 'george',
      source: 'telegram',
      raw_text: JSON.stringify(извл),
      classified_as: разбор.тип,
      processed: true,
    });
    if (inboxРезульт.error) {
      console.error('[supa inbox ERROR]', JSON.stringify(inboxРезульт.error, null, 2));
    } else {
      console.log('[supa] inbox ✓');
    }

    if (разбор.тип === 'task') {
      const due_date = извл.start_iso ? извл.start_iso.split('T')[0] : null;
      const запись = {
        owner:        'george',
        text:         извл.text || 'Без названия',
        quadrant:     извл.quadrant || 'schedule',
        cat:          извл.cat || null,
        time_label:   извл.time || null,
        xp_value:     ({do:75,schedule:50,delegate:25,eliminate:25}[извл.quadrant] || 50),
        start_iso:    извл.start_iso || null,
        due_date:     due_date,
        duration_min: извл.duration_min || 60,
      };
      console.log('[supa] INSERT task:', JSON.stringify(запись));
      const { data, error } = await supa.from('tasks').insert(запись).select();
      if (error) {
        console.error('[supa task ERROR]', JSON.stringify(error, null, 2));
        return false;
      }
      const newId = data?.[0]?.id;
      console.log('[supa] task ✓ id=' + newId);

      // ── Google Calendar: создаём событие если есть время и категория есть в маппинге
      if (извл.start_iso && GCal.googleАктивен() && newId) {
        const рез = await GCal.создатьСобытие({
          text:       извл.text,
          cat:        извл.cat,
          start_iso:  извл.start_iso,
          duration_min: извл.duration_min || 60,
          notes:      разбор.ответ_пользователю,
        });
        if (рез.ok) {
          await supa.from('tasks').update({
            google_event_id:   рез.id,
            google_event_link: рез.link,
          }).eq('id', newId);
          // Прокидываем обратно в разбор — карточка покажет кнопку "Открыть событие"
          разбор.gcal_link     = рез.link;
          разбор.gcal_calendar = рез.календарь;
          console.log(`[gcal] ✓ событие создано в "${рез.календарь}"`);
        } else if (рез.error) {
          console.warn(`[gcal] ошибка: ${рез.error}`);
        } else if (рез.skipped) {
          console.log(`[gcal] пропущено: ${рез.skipped}`);
        }
      }
      return true;
    }

    if (разбор.тип === 'waiting') {
      const { data, error } = await supa.from('waitings').insert({
        owner:        'george',
        person_name:  извл.name || null,
        what:         извл.what || извл.text || 'Что-то ждём',
        context:      извл.context || извл.notes || null,
        due_date:     parseDate(извл.due),
        status:       'waiting',
      }).select();
      if (error) {
        console.error('[supa waiting ERROR]', JSON.stringify(error, null, 2));
        return false;
      }
      console.log('[supa] waiting ✓ id=' + data?.[0]?.id);
      return true;
    }

    if (разбор.тип === 'content_idea') {
      const платформы = Array.isArray(извл.platforms) && извл.platforms.length
                         ? извл.platforms
                         : ['instagram'];
      const { data, error } = await supa.from('content_items').insert({
        owner:        'george',
        title:        извл.title || извл.text || 'Идея',
        text:         извл.text || извл.description || null,
        platforms:    платформы,
        content_type: извл.content_type || null,
        status:       'idea',
        refs:         извл.refs || [],
      }).select();
      if (error) {
        console.error('[supa content_idea ERROR]', JSON.stringify(error, null, 2));
        return false;
      }
      console.log('[supa] content_idea ✓ id=' + data?.[0]?.id);
      return true;
    }

    // idea / decision / meeting_notes / mood — записаны в inbox выше
    // → когда подключим Notion, они пойдут туда
    return разбор.тип !== 'question';
  } catch (err) {
    console.error('[supa] исключение:', err.message, err.stack);
    return false;
  }
}

function parseDate(стр) {
  if (!стр) return null;
  // Простой парсер — даты типа "2026-07-15" пропускаем как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(стр)) return стр;
  return null;
}

// ── ГЕНЕРАТОР GOOGLE CALENDAR URL ─────────────────────────────────────────────
// Открывает Calendar с заполненным событием — пользователь жмёт Save в один клик.
function генерироватьGcalUrl(извл) {
  if (!извл?.start_iso) return null;
  try {
    const startDate = new Date(извл.start_iso);
    if (isNaN(startDate.getTime())) return null;

    const длительность = извл.duration_min || 60;
    const endDate = new Date(startDate.getTime() + длительность * 60000);

    // Формат gcal: YYYYMMDDTHHMMSSZ для конкретного времени
    const формат = d => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

    const params = new URLSearchParams({
      action:  'TEMPLATE',
      text:    извл.text || 'Задача',
      dates:   `${формат(startDate)}/${формат(endDate)}`,
      details: (извл.cat ? `Категория: ${извл.cat}\n` : '') +
               'Создано через LIFE OS бот',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch (err) {
    console.warn('[gcal] не смог сгенерировать URL:', err.message);
    return null;
  }
}

// ── ОБРАБОТКА ОШИБОК ──────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error('Ошибка бота:', err);
});

// ── GRACEFUL SHUTDOWN — даём Telegram отпустить getUpdates ────────────────────
async function остановить(сигнал) {
  console.log(`📴 Получен ${сигнал} — корректное завершение…`);
  try {
    await bot.stop();
    console.log('✅ Бот остановлен');
  } catch (err) {
    console.error('Ошибка остановки:', err);
  }
  process.exit(0);
}
process.once('SIGINT',  () => остановить('SIGINT'));
process.once('SIGTERM', () => остановить('SIGTERM'));

// ── ЗАПУСК ────────────────────────────────────────────────────────────────────
async function запустить() {
  try {
    // На случай если где-то висит webhook — снимаем его (long polling несовместим с webhook)
    // drop_pending_updates: true очищает очередь старых апдейтов
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (err) {
    console.warn('Не удалось снять webhook:', err.message);
  }

  try {
    await bot.api.setMyCommands([
      { command: 'today',     description: '📅 Утренний брифинг' },
      { command: 'plan',      description: '🗓 План на сегодня' },
      { command: 'dashboard', description: '📊 Дашборд' },
      { command: 'kanban',    description: '📋 Канбан-доска' },
      { command: 'report',    description: '📈 Итог дня' },
      { command: 'decompose', description: '🧩 Разбить задачу на шаги' },
      { command: 'summary',   description: '🌙 Вечерний чек-ин' },
      { command: 'chat',      description: '💬 Режим разговора' },
    ]);
  } catch (err) { console.warn('setMyCommands:', err.message); }

  console.log('🤖 LIFE OS бот запущен');
  console.log(`📱 Mini App: ${WEBAPP_BASE}`);
  console.log(`💾 Supabase: ${supa ? 'подключён' : 'НЕ подключён'}`);

  // Поднимаем базы данных в Notion (создаст недостающие, использует существующие)
  if (Notion.notionАктивен()) {
    const ок = await Notion.поднятьБазы();
    if (ок) {
      console.log('📓 Notion: базы готовы', JSON.stringify(Notion.idБаз(), null, 2));
    } else {
      console.log('📓 Notion: ошибка инициализации (см. выше)');
    }
  } else {
    console.log('📓 Notion: НЕ настроен (нет NOTION_TOKEN или NOTION_ROOT_PAGE_ID)');
  }

  // Регистрируем обработчики defer/mirror/checkin callback-кнопок
  зарегистрироватьОбработчики({ bot, supa, openai, ownerTgId: OWNER_TG_ID });

  // Регистрируем callback-кнопки декомпозиции (dec:save/edit/cancel)
  зарегистрироватьДекомпозицию({ bot, supa, openai });

  // Запускаем cron-расписание (8:00 брифинг + 21:00 чекин)
  запуститьРасписание({
    bot, supa, openai,
    ownerTgId: OWNER_TG_ID,
    безКэша,
    ДИРЕКТОР_ПРОМТ,
  });

  await bot.start({
    drop_pending_updates: true,    // не обрабатывать старые сообщения при старте
    onStart: (инфо) => console.log(`✅ Polling запущен · @${инфо.username}`),
  });
}

запустить().catch((err) => {
  console.error('💥 Критическая ошибка запуска:', err);
  process.exit(1);
});
