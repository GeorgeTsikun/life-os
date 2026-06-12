// ── LIFE OS — Автоматическое расписание бота ─────────────────────────────────
// Запускается при старте бота, работает в фоне через node-cron.
// Брифинг 08:00 + Чек-ин 21:00 Europe/Moscow

import cron from 'node-cron';
import { InlineKeyboard } from 'grammy';

// Московское смещение в мс (+3ч)
const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;

function сегодняМосква() {
  const utc   = Date.now();
  const msc   = new Date(utc + MOSCOW_OFFSET);
  return msc.toISOString().split('T')[0]; // YYYY-MM-DD по Москве
}

function вчераМосква() {
  const utc   = Date.now() - 86400000;
  const msc   = new Date(utc + MOSCOW_OFFSET);
  return msc.toISOString().split('T')[0];
}

// ── Главная функция: инициализация cron-задач ─────────────────────────────────
export function запуститьРасписание({ bot, supa, openai, ownerTgId, безКэша, ДИРЕКТОР_ПРОМТ }) {
  if (!ownerTgId) {
    console.warn('[cron] OWNER_TELEGRAM_ID не задан — расписание не запущено');
    return;
  }

  // 08:00 по Москве
  cron.schedule('0 8 * * *', () => {
    утреннийАвтоБрифинг({ bot, supa, openai, ownerTgId, безКэша, ДИРЕКТОР_ПРОМТ })
      .catch(err => console.error('[cron 8:00]', err.message));
  }, { timezone: 'Europe/Moscow' });

  // 21:00 по Москве
  cron.schedule('0 21 * * *', () => {
    вечернийАвтоЧекин({ bot, ownerTgId, безКэша })
      .catch(err => console.error('[cron 21:00]', err.message));
  }, { timezone: 'Europe/Moscow' });

  console.log('[cron] ✅ Расписание запущено: брифинг 08:00 + чекин 21:00 Europe/Moscow');
}

// ── УТРЕННИЙ БРИФИНГ (авто в 8:00) ───────────────────────────────────────────
export async function утреннийАвтоБрифинг({ bot, supa, openai, ownerTgId, безКэша, ДИРЕКТОР_ПРОМТ }) {
  const сегодня = сегодняМосква();
  const вчера   = вчераМосква();

  // Загружаем задачи из Supabase
  let задачиСегодня = [];
  let просроченные  = [];
  let ожидания      = [];

  if (supa) {
    const [резСегодня, резПросроч, резОжид] = await Promise.all([
      supa.from('tasks')
        .select('id,text,quadrant,cat,xp_value,due_date,defer_count')
        .eq('owner', 'george')
        .eq('done', false)
        .or(`due_date.eq.${сегодня},quadrant.eq.do`)
        .order('due_date', { ascending: true })
        .limit(20),
      supa.from('tasks')
        .select('id,text,quadrant,cat,xp_value,due_date,defer_count')
        .eq('owner', 'george')
        .eq('done', false)
        .lt('due_date', сегодня)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(10),
      supa.from('waitings')
        .select('person_name,what,due_date')
        .eq('owner', 'george')
        .eq('status', 'waiting')
        .lte('due_date', сегодня)
        .limit(5),
    ]);

    задачиСегодня = резСегодня.data || [];
    просроченные  = (резПросроч.data || []).filter(t => t.due_date < сегодня);
    ожидания      = резОжид.data || [];
  }

  // GPT формирует текст брифинга
  const срочные   = задачиСегодня.filter(t => t.quadrant === 'do').map(t => `⚡ ${t.text}`);
  const рост      = задачиСегодня.filter(t => t.quadrant === 'schedule').map(t => `🏔️ ${t.text}`);
  const сегодняТекст = [...срочные, ...рост].slice(0, 5).join('\n') || 'нет задач на сегодня';
  const ожиданийТекст = ожидания.map(o => `• ${o.what} ← ${o.person_name || '?'}`).join('\n') || 'нет';

  let брифингТекст = '';
  if (openai) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ДИРЕКТОР_ПРОМТ },
          { role: 'system', content:
            `Сегодня ${сегодня} (Москва). Это АВТОМАТИЧЕСКИЙ утренний брифинг.\n` +
            `Задачи ШТУРМ и РОСТ на сегодня:\n${сегодняТекст}\n\n` +
            `Ожидания от других (горят):\n${ожиданийТекст}\n\n` +
            `Напиши короткий (3-4 строки) боевой брифинг. Без воды.`
          },
          { role: 'user', content: 'Что сегодня?' },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });
      брифингТекст = completion.choices[0].message.content;
    } catch (err) {
      console.error('[cron] GPT брифинг:', err.message);
      брифингТекст = сегодняТекст;
    }
  } else {
    брифингТекст = `Фокус дня:\n${сегодняТекст}`;
  }

  const дата = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow'
  });

  let текстСообщ = `☀️ *Утренний брифинг · ${дата}*\n\n${брифингТекст}`;

  const клавиатура = new InlineKeyboard()
    .webApp('⚡ Открыть LIFE OS', безКэша())
    .row();

  // Отправляем основной брифинг
  await bot.api.sendMessage(ownerTgId, текстСообщ, {
    parse_mode: 'Markdown',
    reply_markup: клавиатура,
  });

  // Отправляем просроченные задачи отдельными карточками
  if (просроченные.length > 0) {
    await bot.api.sendMessage(ownerTgId,
      `🔴 *Висит со вчера (${просроченные.length}):*\nЧто делаем с каждой?`,
      { parse_mode: 'Markdown' }
    );

    for (const задача of просроченные.slice(0, 5)) {
      await отправитьКарточкуПереноса(bot, ownerTgId, задача);
    }
  }
}

// ── КАРТОЧКА ПЕРЕНОСА (для просроченных задач) ────────────────────────────────
export async function отправитьКарточкуПереноса(bot, ownerTgId, задача) {
  const квадрантИконка = {
    do: '⚡', schedule: '🏔️', delegate: '⚙️', eliminate: '🌀'
  }[задача.quadrant] || '📋';

  const дней = задача.due_date
    ? Math.floor((Date.now() - new Date(задача.due_date + 'T00:00:00+03:00').getTime()) / 86400000)
    : 0;
  const дняСтрока = дней > 0 ? ` _(${дней} дн. назад)_` : '';

  const клав = new InlineKeyboard()
    .text('✅ Готово',    `defer:${задача.id}:done`)
    .text('📅 Сегодня',  `defer:${задача.id}:today`).row()
    .text('➡️ Завтра',   `defer:${задача.id}:tomorrow`)
    .text('🗑 Отменить', `defer:${задача.id}:cancel`);

  await bot.api.sendMessage(ownerTgId,
    `${квадрантИконка} *${задача.text}*${дняСтрока}\n` +
    `_Категория: ${задача.cat || '—'} · ${задача.xp_value || 10} XP_`,
    { parse_mode: 'Markdown', reply_markup: клав }
  );
}

// ── ВЕЧЕРНИЙ ЧЕК-ИН (авто в 21:00) ──────────────────────────────────────────
async function вечернийАвтоЧекин({ bot, ownerTgId, безКэша }) {
  const клавиатура = new InlineKeyboard()
    .text('🎙️ Голосом',  'checkin:voice')
    .text('📝 Текстом',  'checkin:text').row()
    .webApp('📊 Открыть статистику', безКэша());

  await bot.api.sendMessage(ownerTgId,
    `🌙 *Вечерний чек-ин*\n\n` +
    `День заканчивается. Что сделано? Что не успел?\n` +
    `Расскажи голосом или напиши — зафиксирую, начислю XP.`,
    { parse_mode: 'Markdown', reply_markup: клавиатура }
  );
}

// ── ДЕТЕКТОР ИЗБЕГАНИЯ (вызывается при каждом переносе) ───────────────────────
export async function проверитьИзбегание(bot, ownerTgId, задача, supa) {
  const deferCount = (задача.defer_count || 0) + 1;

  if (deferCount >= 3) {
    // Это системное избегание — психологическое зеркало
    const клав = new InlineKeyboard()
      .text('😱 Страх объёма',       `mirror:${задача.id}:fear`)
      .text('❓ Неясен шаг',         `mirror:${задача.id}:unclear`).row()
      .text('📭 Уже не нужна',       `mirror:${задача.id}:irrelevant`)
      .text('🎙️ Расскажу голосом',  `mirror:${задача.id}:voice`);

    await bot.api.sendMessage(ownerTgId,
      `🪞 *Ты переносишь "${задача.text}" уже ${deferCount}-й раз.*\n\n` +
      `Это системное избегание. Что происходит на самом деле?`,
      { parse_mode: 'Markdown', reply_markup: клав }
    );
    return true; // показали зеркало
  }
  return false;
}

// ── ОБРАБОТКА CALLBACK defer:id:action ────────────────────────────────────────
export function зарегистрироватьОбработчики({ bot, supa, openai, ownerTgId }) {
  // Кнопки переноса задач
  bot.callbackQuery(/^defer:(.+):(done|today|tomorrow|cancel)$/, async (ctx) => {
    const id     = ctx.match[1];
    const action = ctx.match[2];
    await ctx.answerCallbackQuery();

    if (!supa) {
      return ctx.reply('⚠️ Supabase не подключён');
    }

    // Загружаем задачу
    const { data: задачи } = await supa.from('tasks')
      .select('id,text,quadrant,cat,xp_value,due_date,defer_count')
      .eq('id', id)
      .eq('owner', 'george')
      .limit(1);

    const задача = задачи?.[0];
    if (!задача) return ctx.reply('❌ Задача не найдена');

    if (action === 'done') {
      await supa.from('tasks').update({ done: true }).eq('id', id);
      await ctx.editMessageText(`✅ *Выполнено:* ${задача.text}`, { parse_mode: 'Markdown' });
      return;
    }

    if (action === 'cancel') {
      await supa.from('tasks').update({ done: true, quadrant: 'eliminate' }).eq('id', id);
      await ctx.editMessageText(`🗑 *Отменено:* ${задача.text}`, { parse_mode: 'Markdown' });
      return;
    }

    // today / tomorrow — сначала проверяем детектор избегания
    const показалоЗеркало = await проверитьИзбегание(bot, ownerTgId, задача, supa);

    let новаяДата;
    const сегодня = сегодняМосква();
    if (action === 'today') {
      новаяДата = сегодня;
    } else { // tomorrow
      const завтра = new Date(Date.now() + 86400000 + MOSCOW_OFFSET);
      новаяДата = завтра.toISOString().split('T')[0];
    }

    await supa.from('tasks').update({
      due_date:    новаяДата,
      defer_count: (задача.defer_count || 0) + 1,
    }).eq('id', id);

    if (!показалоЗеркало) {
      const ярлык = action === 'today' ? 'Сегодня' : 'Завтра';
      await ctx.editMessageText(
        `📅 Перенесено на *${ярлык}:* ${задача.text}`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Ответы на психологическое зеркало
  bot.callbackQuery(/^mirror:(.+):(fear|unclear|irrelevant|voice)$/, async (ctx) => {
    const id     = ctx.match[1];
    const reason = ctx.match[2];
    await ctx.answerCallbackQuery();

    const ответы = {
      fear:       '😱 *Страх объёма* — значит задача слишком большая. Разбей на первый шаг (15 мин). Что ОДНО можно сделать прямо сейчас?',
      unclear:    '❓ *Неясен шаг* — сформулируй задачу как одно конкретное действие. Что точно нужно сделать первым?',
      irrelevant: '📭 *Уже не нужна* — окей, удаляю. Иногда лучшее решение — не делать.',
      voice:      '🎙️ Жду голосовое — расскажи что происходит.',
    };

    if (reason === 'irrelevant' && supa) {
      await supa.from('tasks').update({ done: true, quadrant: 'eliminate' }).eq('id', id);
    }

    // Сохраняем в inbox для анализа
    if (supa && reason !== 'voice') {
      await supa.from('inbox').insert({
        owner: 'george',
        source: 'avoidance_mirror',
        raw_text: `defer_mirror: task_id=${id} reason=${reason}`,
        classified_as: 'decision',
        processed: true,
      });
    }

    await ctx.editMessageText(ответы[reason], { parse_mode: 'Markdown' });
  });

  // Кнопки вечернего чекина
  bot.callbackQuery('checkin:text', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('📝 Напиши что сделал сегодня — я зафиксирую и начислю XP.');
  });

  bot.callbackQuery('checkin:voice', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('🎙️ Жду голосовое — расскажи как прошёл день.');
  });
}
