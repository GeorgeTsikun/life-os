// ── LIFE OS — Telegram-бот ────────────────────────────────────────────────────
// Запускается на Railway, подключается к OpenAI и Supabase.
// Голосовые → Whisper → GPT-4o → структурирует и (когда Supabase активен) сохраняет.

import 'dotenv/config';
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

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

const КЛАССИФИКАТОР_ПРОМТ = `Ты классифицируешь голосовые/текстовые сообщения пользователя.
Определи что это (одно из):
- task          — новая задача
- waiting       — ожидание от кого-то
- idea          — идея в банк
- checkin       — вечерний отчёт о сделанном
- meeting_notes — транскрибация созвона/встречи
- decision      — важное решение
- question      — вопрос к директору
- mood          — состояние/самочувствие

Верни ТОЛЬКО валидный JSON:
{
  "тип": "...",
  "уверенность": 0-100,
  "извлечено": {
    // для task: text, quadrant (do|schedule|delegate|eliminate), cat, time
    // для waiting: name, what, due
    // для idea: text
    // для checkin: completed: [], добавлено: [], энергия: 1-10
    // для decision: text, контекст
  },
  "ответ_пользователю": "короткий человеческий ответ (1-2 предложения)"
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

    const разбор = JSON.parse(completion.choices[0].message.content);
    const ярлык  = {
      task:'📋 Задача', waiting:'⏳ Ожидание', idea:'💡 Идея',
      checkin:'🌙 Чек-ин', meeting_notes:'📝 Заметки встречи',
      decision:'🔑 Решение', question:'❓ Вопрос', mood:'⚡ Состояние'
    }[разбор.тип] || '📌 Запись';

    // Сохраняем в Supabase если подключен
    let сохранён = false;
    if (supa) сохранён = await сохранитьВSupabase(ctx.from.id.toString(), разбор);

    // Клавиатура подтверждения
    const клавиатура = new InlineKeyboard();
    if (разбор.тип === 'task') {
      клавиатура.text('✅ В Q1 (срочно)', `add_task:do`).text('📅 В Q2', `add_task:schedule`).row();
    }
    клавиатура.webApp('🔍 Открыть в приложении', WEBAPP_URL);

    const извлечено = JSON.stringify(разбор.извлечено, null, 2);
    await ctx.reply(
      `${ярлык}\n\n${разбор.ответ_пользователю}\n\n` +
      `\`\`\`json\n${извлечено}\n\`\`\`\n` +
      (сохранён ? '_✓ сохранено в облако_' : '_ℹ️ Supabase не настроен — открой Mini App чтобы сохранить вручную_'),
      { parse_mode: 'Markdown', reply_markup: клавиатура }
    );

  } catch (err) {
    console.error('обработать вход:', err);
    await ctx.reply(`⚠️ ${err.message}`);
  }
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
  if (!supa) return false;
  const извл = разбор.извлечено || {};
  try {
    // Запись в inbox для всех типов — лог
    await supa.from('inbox').insert({
      owner: 'george',
      source: 'telegram',
      raw_text: JSON.stringify(извл),
      classified_as: разбор.тип,
      processed: true,
    }).catch(() => {});

    if (разбор.тип === 'task') {
      await supa.from('tasks').insert({
        owner:      'george',
        text:       извл.text || 'Без названия',
        quadrant:   извл.quadrant || 'schedule',
        cat:        извл.cat,
        time_label: извл.time,
        xp_value:   ({do:75,schedule:50,delegate:25,eliminate:25}[извл.quadrant] || 50),
      });
      return true;
    }

    if (разбор.тип === 'waiting') {
      await supa.from('waitings').insert({
        owner:        'george',
        person_name:  извл.name,
        what:         извл.what || извл.text || 'Что-то ждём',
        context:      извл.context || извл.notes,
        due_date:     parseDate(извл.due),
        status:       'waiting',
      });
      return true;
    }

    // idea / decision / meeting_notes / mood — пока пишем в inbox (выше)
    // потом эти типы пойдут в Notion
    return разбор.тип !== 'question';
  } catch (err) {
    console.error('сохранить:', err.message);
    return false;
  }
}

function parseDate(стр) {
  if (!стр) return null;
  // Простой парсер — даты типа "2026-07-15" пропускаем как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(стр)) return стр;
  return null;
}

// ── ОБРАБОТКА ОШИБОК ──────────────────────────────────────────────────────────
bot.catch((err) => {
  console.error('Ошибка бота:', err);
});

// ── ЗАПУСК ────────────────────────────────────────────────────────────────────
console.log('🤖 LIFE OS бот запущен');
console.log(`📱 Mini App: ${WEBAPP_URL}`);
console.log(`💾 Supabase: ${supa ? 'подключён' : 'НЕ подключён (бот работает без сохранения данных)'}`);
bot.start();
