// ── LIFE OS — Автоматическое расписание бота ─────────────────────────────────
// Запускается при старте бота, работает в фоне через node-cron.
// Брифинг 08:00 + Чек-ин 21:00 Europe/Moscow

import cron from 'node-cron';
import { InlineKeyboard } from 'grammy';
import { sendRichWithFallback, briefingBlocks, checkinBlocks, T, B } from './rich.js';

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
    вечернийАвтоЧекин({ bot, ownerTgId, безКэша, supa })
      .catch(err => console.error('[cron 21:00]', err.message));
  }, { timezone: 'Europe/Moscow' });

  console.log('[cron] ✅ Расписание запущено: брифинг 08:00 + чекин 21:00 Europe/Moscow');
}

// ── УТРЕННИЙ БРИФИНГ (авто в 8:00) ───────────────────────────────────────────
export async function утреннийАвтоБрифинг({ bot, supa, openai, ownerTgId, безКэша, ДИРЕКТОР_ПРОМТ }) {
  const сегодня = сегодняМосква();

  // Загружаем задачи + здоровье из Supabase
  let задачиСегодня = [];
  let просроченные  = [];
  let ожидания      = [];
  let здоровье      = null;

  if (supa) {
    const [резСегодня, резПросроч, резОжид, резЗдор] = await Promise.all([
      supa.from('tasks')
        .select('id,text,quadrant,cat,xp_value,due_date,defer_count')
        .eq('owner', 'george')
        .eq('done', false)
        .eq('cancelled', false)
        .or(`due_date.eq.${сегодня},quadrant.eq.do`)
        .order('due_date', { ascending: true })
        .limit(20),
      supa.from('tasks')
        .select('id,text,quadrant,cat,xp_value,due_date,defer_count')
        .eq('owner', 'george')
        .eq('done', false)
        .eq('cancelled', false)
        .lt('due_date', сегодня)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(10),
      // Ожидания (новая таблица expectations)
      supa.from('expectations')
        .select('owner_name,what,deadline')
        .eq('owner', 'george')
        .eq('status', 'pending')
        .lte('deadline', сегодня)
        .limit(5)
        .maybeSingle()
        .then(r => ({ data: r.data ? [r.data] : [] }))
        .catch(() => ({ data: [] })),
      // Последние данные здоровья
      supa.from('health_logs')
        .select('hrv,sleep_hours,resting_hr,steps')
        .eq('owner', 'george')
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null })),
    ]);

    задачиСегодня = резСегодня.data || [];
    просроченные  = (резПросроч.data || []).filter(t => t.due_date < сегодня);
    // Ожидания: пробуем и новую таблицу и старую waitings
    if (!ожидания.length) {
      const резWait = await supa.from('waitings')
        .select('person_name,what,due_date')
        .eq('owner', 'george')
        .eq('status', 'waiting')
        .lte('due_date', сегодня)
        .limit(5)
        .catch(() => ({ data: [] }));
      ожидания = (резWait.data || []).map(w => ({ owner_name: w.person_name, what: w.what, deadline: w.due_date }));
    }
    здоровье = резЗдор.data;
  }

  // Формируем блок здоровья
  let блокЗдоровья = '';
  if (здоровье) {
    const hrv   = здоровье.hrv   || 0;
    const sleep = здоровье.sleep_hours || 0;
    const rc    = sleep && hrv ? ((sleep/8) * (hrv/55)).toFixed(2) : null;
    const rcМетка = rc >= 1.1 ? '🚀 Высокий' : rc >= 0.8 ? '⚡ Норма' : rc ? '🐢 Низкий' : null;
    const hrvСтатус = hrv >= 60 ? '✅' : hrv >= 40 ? '🟡' : '🔴';
    блокЗдоровья = [
      `📊 HRV: ${hrvСтатус} ${hrv}мс  |  🌙 Сон: ${sleep}ч`,
      rcМетка ? `⚡ RC: ${rcМетка} (${rc})` : '',
    ].filter(Boolean).join('\n');
  }

  // §4.3 Debuff-тон: если HRV < 30 → критический режим
  const hrv = здоровье?.hrv || 99;
  const debuffActive = hrv < 30;
  const debuffКонтекст = debuffActive
    ? `\n⚠️ КРИТИЧЕСКИЙ РЕЖИМ: HRV = ${hrv}мс (< 30). Это серьёзное истощение организма. Используй тревожный/защитный тон. Посоветуй сократить Q1 задачи, больше отдыхать. Запрети сложные решения.`
    : '';

  const срочные   = задачиСегодня.filter(t => t.quadrant === 'do').map(t => `⚡ ${t.text}`);
  const рост      = задачиСегодня.filter(t => t.quadrant === 'schedule').map(t => `🏔️ ${t.text}`);
  const сегодняТекст = [...срочные, ...рост].slice(0, 5).join('\n') || 'нет задач на сегодня';
  const ожиданийТекст = ожидания.map(o => `• ${o.what} ← ${o.owner_name || '?'}`).join('\n') || 'нет';

  let брифингТекст = '';
  if (openai) {
    try {
      const контекстЗдор = здоровье
        ? `\nДанные здоровья: HRV ${здоровье.hrv}мс, сон ${здоровье.sleep_hours}ч, пульс ${здоровье.resting_hr || '—'}.`
        : '';
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ДИРЕКТОР_ПРОМТ },
          { role: 'system', content:
            `Сегодня ${сегодня} (Москва). Это АВТОМАТИЧЕСКИЙ утренний брифинг.${контекстЗдор}${debuffКонтекст}\n` +
            `Задачи на сегодня:\n${сегодняТекст}\n\n` +
            `Ожидания (горят):\n${ожиданийТекст}\n\n` +
            (debuffActive
              ? `ТРЕВОЖНЫЙ РЕЖИМ: напиши защитный брифинг. Начни с предупреждения о критическом состоянии. Запрети себе брать новое. Рекомендуй минимум задач и обязательный отдых.`
              : `Напиши короткий (2-3 строки) боевой брифинг. Тон: директор → самому себе. Без воды.`)
          },
          { role: 'user', content: 'Что сегодня?' },
        ],
        temperature: 0.7,
        max_tokens: 220,
      });
      брифингТекст = completion.choices[0].message.content;
    } catch (err) {
      console.error('[cron] GPT брифинг:', err.message);
      брифингТекст = `Фокус дня:\n${сегодняТекст}`;
    }
  } else {
    брифингТекст = `Фокус дня:\n${сегодняТекст}`;
  }

  const дата = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow'
  });

  // ── Rich Message (Bot API 10.1) ────────────────────────────────────────────
  const q1List = задачиСегодня.filter(t => t.quadrant === 'do')
    .map(t => ({ text: t.text, xp: t.xp_value, cat: t.cat }));
  const q2List = задачиСегодня.filter(t => t.quadrant === 'schedule')
    .map(t => ({ text: t.text, xp: t.xp_value }));
  const ожиданияList = ожидания.map(o => {
    const dDays = o.deadline ? Math.floor((new Date(o.deadline) - Date.now()) / 86400000) : 0;
    return { what: o.what, ownerName: o.owner_name || '?', daysLeft: dDays };
  });
  const overdueList = просроченные.map(t => ({
    text:        t.text,
    defer_count: t.defer_count || 0,
    daysAgo:     t.due_date ? Math.floor((Date.now() - new Date(t.due_date + 'T00:00:00+03:00')) / 86400000) : 1,
  }));

  const richBlocks = briefingBlocks({
    date:         дата,
    health:       здоровье ? {
      hrv:      здоровье.hrv,
      sleep:    здоровье.sleep_hours,
      rc:       здоровье.hrv && здоровье.sleep_hours ? (здоровье.sleep_hours/8) * (здоровье.hrv/55) : null,
    } : null,
    q1Tasks:      q1List,
    q2Tasks:      q2List,
    aiInsight:    брифингТекст,
    overdue:      overdueList,
    expectations: ожиданияList,
    debuff:       debuffActive,
  });

  // Markdown fallback (если Rich не поддерживается клиентом)
  const markdownFallback = [
    `☀️ *Утренний брифинг · ${дата}*`,
    блокЗдоровья ? `\n${блокЗдоровья}` : '',
    `\n${брифингТекст}`,
    ожидания.length ? `\n🕐 *Жду от других:*\n${ожиданийТекст}` : '',
    просроченные.length ? `\n🔴 *Висит (${просроченные.length}):* ${просроченные.slice(0,3).map(t=>t.text).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const клавиатура = new InlineKeyboard()
    .webApp('⚡ Открыть LIFE OS', безКэша())
    .row();

  const token = process.env.BOT_TOKEN;
  await sendRichWithFallback(token, ownerTgId, richBlocks, markdownFallback, {
    reply_markup: клавиатура,
  });

  // Просроченные — отдельными карточками с inline-кнопками переноса
  // (оставляем как есть — это интерактивные карточки, не просто форматирование)
  if (просроченные.length > 0) {
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
async function вечернийАвтоЧекин({ bot, ownerTgId, безКэша, supa }) {
  const сегодня = сегодняМосква();

  // Статистика дня из Supabase
  let выполнено = 0;
  let заработаноXP = 0;
  let q1Закрыто = 0;

  if (supa) {
    try {
      const { data } = await supa.from('tasks')
        .select('quadrant,xp_value')
        .eq('owner', 'george')
        .eq('done', true)
        .gte('completed_at', `${сегодня}T00:00:00`)
        .lte('completed_at', `${сегодня}T23:59:59`);

      if (data?.length) {
        выполнено = data.length;
        заработаноXP = data.reduce((s, t) => s + (t.xp_value || 10), 0);
        q1Закрыто = data.filter(t => t.quadrant === 'do').length;
      }
    } catch (err) {
      console.error('[cron 21:00] статистика:', err.message);
    }
  }

  // ── Rich Message (Bot API 10.1) ────────────────────────────────────────────
  // Ищем лучшую задачу на завтра (Q1 с наивысшим XP)
  let завтраТоп = null;
  if (supa) {
    try {
      const завтра = new Date(Date.now() + 86400000 + 3 * 3600000).toISOString().split('T')[0];
      const { data: завтраЗадачи } = await supa.from('tasks')
        .select('text,xp_value,cat')
        .eq('owner', 'george')
        .eq('done', false)
        .eq('quadrant', 'do')
        .order('xp_value', { ascending: false })
        .limit(1);
      завтраТоп = завтраЗадачи?.[0] || null;
    } catch {}
  }

  // Считаем стрик из профиля (если есть)
  let стрик = 0;
  if (supa) {
    try {
      const { data: prof } = await supa.from('profiles').select('streak').eq('owner', 'george').maybeSingle();
      стрик = prof?.streak || 0;
    } catch {}
  }

  const richBlocks = checkinBlocks({
    done:      выполнено,
    xp:        заработаноXP,
    q1closed:  q1Закрыто,
    streak:    стрик,
    topTomorrow: завтраТоп ? { text: завтраТоп.text, xp: завтраТоп.xp_value, cat: завтраТоп.cat } : null,
  });

  const клавиатура = new InlineKeyboard()
    .text('🎙️ Голосом',  'checkin:voice')
    .text('📝 Текстом',  'checkin:text').row()
    .webApp('📊 Открыть LIFE OS', безКэша());

  // Markdown fallback
  const статБлок = выполнено > 0
    ? `✅ Сегодня: *${выполнено} задач* (+${заработаноXP} XP)${q1Закрыто > 0 ? ` · Q1: ${q1Закрыто}` : ''}`
    : '📭 Задач не закрыто — расскажи почему?';
  const markdownFallback = `🌙 *Вечерний чек-ин*\n${статБлок}\n\nКак прошёл день? Расскажи голосом или напиши.`;

  const token = process.env.BOT_TOKEN;
  await sendRichWithFallback(token, ownerTgId, richBlocks, markdownFallback, {
    reply_markup: клавиатура,
  });
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
