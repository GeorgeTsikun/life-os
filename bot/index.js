// ── LIFE OS — Telegram-бот ────────────────────────────────────────────────────
// Запускается на Railway, подключается к OpenAI и Supabase.
// Голосовые → Whisper → GPT-4o → структурирует и (когда Supabase активен) сохраняет.

import 'dotenv/config';
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as Notion from './notion.js';

// ── КОНФИГ ────────────────────────────────────────────────────────────────────
const TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
const WEBAPP_URL    = process.env.TELEGRAM_WEBAPP_URL || 'https://life-os-chi-rose.vercel.app';
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

const ТЕКУЩАЯ_ДАТА = () => new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const КЛАССИФИКАТОР_ПРОМТ = `Сегодня ${ТЕКУЩАЯ_ДАТА()}. Часовой пояс пользователя: Москва (UTC+3).

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
    .webApp('⚡ Открыть LIFE OS', WEBAPP_URL).row()
    .text('📅 План на сегодня', 'today')
    .text('🌙 Вечерний чек-ин', 'evening');

  await ctx.reply(
    `*${имя}, добро пожаловать в LIFE OS* 👑\n\n` +
    `Я твой персональный AI-директор.\n\n` +
    `Просто говори со мной голосом или текстом:\n` +
    `• 🎙️ Запиши голосовое — я расшифрую и пойму что это (задача, идея, решение)\n` +
    `• 💬 Напиши вопрос — отвечу с учётом твоего контекста\n` +
    `• /today — план дня\n` +
    `• /summary — вечерний отчёт\n` +
    `• /chat — режим разговора`,
    { parse_mode: 'Markdown', reply_markup: клавиатура }
  );
});

// ── /today ────────────────────────────────────────────────────────────────────
bot.command('today', async (ctx) => утреннийБрифинг(ctx));
bot.callbackQuery('today',  async (ctx) => { await ctx.answerCallbackQuery(); утреннийБрифинг(ctx); });

async function утреннийБрифинг(ctx) {
  await ctx.replyWithChatAction('typing');
  const userId   = ctx.from.id.toString();
  const контекст = await загрузитьКонтекст(userId);

  const ответ = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: ДИРЕКТОР_ПРОМТ },
      { role: 'system', content: `Сейчас утро. Дай план дня. Контекст:\n${JSON.stringify(контекст, null, 2)}` },
      { role: 'user',   content: 'Что сегодня?' },
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  const клавиатура = new InlineKeyboard().webApp('Открыть LIFE OS', WEBAPP_URL);
  await ctx.reply(`☀️ *Утренний брифинг*\n\n${ответ.choices[0].message.content}`, {
    parse_mode: 'Markdown',
    reply_markup: клавиатура,
  });
}

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

// ── ТЕКСТОВЫЕ СООБЩЕНИЯ ───────────────────────────────────────────────────────
bot.on('message:text', async (ctx) => {
  const сообщ = ctx.message.text;
  if (сообщ.startsWith('/')) return; // команды обрабатываются выше

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
      await отправитьКарточкуРазбора(ctx, items[i], текст, i + 1, items.length);
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
      .text('🌀 Ловушка',  'move:eliminate').row();
    const gcalUrl = генерироватьGcalUrl(разбор.извлечено);
    if (gcalUrl) клавиатура.url('📅 В Google Calendar', gcalUrl).row();
  }
  if (разбор.тип === 'content_idea') {
    клавиатура.webApp('🎬 Открыть Контент', `${WEBAPP_URL}?tab=content`).row();
  } else {
    клавиатура.webApp('🔍 Открыть в приложении', WEBAPP_URL);
  }

  const извлечено = JSON.stringify(разбор.извлечено, null, 2);
  const notionСтрока = notionРезульт.записал
    ? `\n_📓 Записано в Notion → ${notionРезульт.база}_`
    : '';
  const подпись = (сохранён
    ? '_✓ сохранено в облако · видно в Mini App_'
    : (supa
        ? '_⚠️ Supabase не сохранил_'
        : '_ℹ️ Supabase не подключён._')
  ) + notionСтрока;

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
      const запись = {
        owner:      'george',
        text:       извл.text || 'Без названия',
        quadrant:   извл.quadrant || 'schedule',
        cat:        извл.cat || null,
        time_label: извл.time || null,
        xp_value:   ({do:75,schedule:50,delegate:25,eliminate:25}[извл.quadrant] || 50),
      };
      console.log('[supa] INSERT task:', JSON.stringify(запись));
      const { data, error } = await supa.from('tasks').insert(запись).select();
      if (error) {
        console.error('[supa task ERROR]', JSON.stringify(error, null, 2));
        return false;
      }
      console.log('[supa] task ✓ id=' + data?.[0]?.id);
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

  console.log('🤖 LIFE OS бот запущен');
  console.log(`📱 Mini App: ${WEBAPP_URL}`);
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

  await bot.start({
    drop_pending_updates: true,    // не обрабатывать старые сообщения при старте
    onStart: (инфо) => console.log(`✅ Polling запущен · @${инфо.username}`),
  });
}

запустить().catch((err) => {
  console.error('💥 Критическая ошибка запуска:', err);
  process.exit(1);
});
