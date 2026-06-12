// ── LIFE OS — Telegram Rich Messages (Bot API 10.1) ──────────────────────────
// Grammy 1.43.0 ещё не поддерживает sendRichMessage → вызываем через fetch напрямую.
// Структура InputRichMessage следует паттернам Bot API + TDLib TL-schema.
//
// Документация: https://core.telegram.org/bots/api#sendrichmessage
// Добавлено в Bot API 10.1 (11 июня 2026)

const TG_BASE = 'https://api.telegram.org/bot';

// ── Хелперы для InputRichText ─────────────────────────────────────────────────
// Каждый создаёт типизированный объект для вложенного форматирования текста

function rt(t) {
  // Строку автоматом оборачиваем в plain
  return typeof t === 'string' ? T.text(t) : t;
}

export const T = {
  /** Обычный текст */
  text:  (s)            => ({ type: 'plain',         text: String(s) }),
  /** Жирный */
  bold:  (t)            => ({ type: 'bold',           text: rt(t) }),
  /** Курсив */
  italic:(t)            => ({ type: 'italic',         text: rt(t) }),
  /** Подчёркнутый */
  under: (t)            => ({ type: 'underline',      text: rt(t) }),
  /** Зачёркнутый */
  strike:(t)            => ({ type: 'strikethrough',  text: rt(t) }),
  /** Спойлер */
  spoil: (t)            => ({ type: 'spoiler',        text: rt(t) }),
  /** Моноширинный */
  code:  (t)            => ({ type: 'code',           text: rt(t) }),
  /** Надстрочный (^) */
  sup:   (t)            => ({ type: 'superscript',    text: rt(t) }),
  /** Подстрочный */
  sub:   (t)            => ({ type: 'subscript',      text: rt(t) }),
  /** Выделенный (маркер) */
  mark:  (t)            => ({ type: 'marked',         text: rt(t) }),
  /** Ссылка */
  url:   (t, url)       => ({ type: 'url',            text: rt(t), url }),
  /** Склейка нескольких частей */
  cat:   (...parts)     => ({ type: 'concat',         texts: parts.map(rt) }),
};

// ── Хелперы для InputRichBlock ────────────────────────────────────────────────
// Создают блоки верхнего уровня для InputRichMessage.blocks

export const B = {
  /** Заголовок секции */
  heading: (t) => ({
    type: 'section_heading',
    text: rt(t),
  }),

  /** Обычный параграф */
  para: (t) => ({
    type: 'paragraph',
    text: rt(t),
  }),

  /** Блок кода / preformatted */
  pre: (t, lang = '') => ({
    type:     'preformatted',
    text:     rt(t),
    language: lang,
  }),

  /** Горизонтальная линия-разделитель */
  divider: () => ({ type: 'divider' }),

  /** Цитата (blockquote) */
  quote: (t) => ({
    type: 'block_quotation',
    text: rt(t),
  }),

  /** Pull-quote (выносная цитата, крупнее обычной) */
  pullquote: (t) => ({
    type: 'pull_quotation',
    text: rt(t),
  }),

  /**
   * Список
   * @param {string[]|Array} items  — строки или {text, sub} объекты
   * @param {boolean} ordered       — нумерованный?
   */
  list: (items, ordered = false) => ({
    type:    'list',
    ordered,
    items: items.map(item => {
      if (typeof item === 'string') return { blocks: [B.para(item)] };
      if (item.text && item.sub) return {
        blocks: [
          B.para(item.text),
          B.para(T.italic(item.sub)),
        ],
      };
      return { blocks: [item] };
    }),
  }),

  /**
   * Сворачиваемая/раскрываемая секция (RichBlockDetails)
   * @param {string|InputRichText} title  — заголовок кнопки
   * @param {InputRichBlock[]}     blocks — содержимое внутри
   * @param {boolean}              open   — раскрыта по умолчанию?
   */
  details: (title, blocks, open = false) => ({
    type:   'details',
    title:  rt(title),
    blocks,
    open,
  }),

  /**
   * Таблица
   * @param {Array<Array<string|{text,align?,bold?,color?}>>} rows
   *   Первая строка считается заголовком (header row)
   */
  table: (rows) => ({
    type: 'table',
    rows: rows.map((row, ri) => ({
      is_header: ri === 0,
      cells: row.map(cell => {
        if (typeof cell === 'string') return { text: T.text(cell), align: 'left' };
        const t = cell.bold ? T.bold(cell.text) : T.text(cell.text);
        return { text: t, align: cell.align || 'center' };
      }),
    })),
  }),

  /** Коллаж изображений (массив file_id) */
  collage: (photoFileIds, caption = null) => ({
    type:     'collage',
    items:    photoFileIds.map(id => ({ file_id: id })),
    caption:  caption ? rt(caption) : undefined,
  }),
};

// ── Главная функция отправки ──────────────────────────────────────────────────

/**
 * Отправить Rich Message через Bot API 10.1 (напрямую, без Grammy)
 *
 * @param {string}       token       BOT_TOKEN
 * @param {number|string} chatId
 * @param {object[]}     blocks      массив InputRichBlock
 * @param {object}       [opts]      доп. параметры (reply_markup, message_thread_id, ...)
 * @returns {Promise<object>}         объект Message из ответа
 */
export async function sendRichMessage(token, chatId, blocks, opts = {}) {
  const body = {
    chat_id:      chatId,
    rich_message: { blocks },
    ...opts,
  };

  const res = await fetch(`${TG_BASE}${token}/sendRichMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) {
    const err = new Error(`[sendRichMessage] ${data.description}`);
    err.code    = data.error_code;
    err.details = data;
    throw err;
  }
  return data.result;
}

/**
 * Fallback: отправить обычное Markdown-сообщение если Rich не поддерживается
 */
export async function sendRichWithFallback(token, chatId, blocks, markdownFallback, opts = {}) {
  try {
    return await sendRichMessage(token, chatId, blocks, opts);
  } catch (err) {
    console.warn('[rich] sendRichMessage failed, falling back to Markdown:', err.message);
    // Отправляем через Grammy-compatible API
    const res = await fetch(`${TG_BASE}${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    chatId,
        text:       markdownFallback,
        parse_mode: 'Markdown',
        ...opts,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`[sendMessage fallback] ${data.description}`);
    return data.result;
  }
}

// ── Готовые шаблоны для LIFE OS ───────────────────────────────────────────────

/**
 * Шаблон утреннего брифинга
 * @param {object} params
 * @param {string}   params.date          — «Вторник, 4 июня»
 * @param {object}   params.health        — { hrv, sleep, rc, rcLabel }
 * @param {string[]} params.q1Tasks       — список текстов Q1-задач
 * @param {string[]} params.q2Tasks       — список Q2-задач
 * @param {string}   params.aiInsight     — текст от GPT
 * @param {object[]} params.overdue       — { text, daysAgo } просроченные
 * @param {object[]} params.expectations  — { what, ownerName, daysLeft } ожидания
 * @param {boolean}  params.debuff        — debuff режим?
 * @returns {InputRichBlock[]}
 */
export function briefingBlocks({ date, health, q1Tasks, q2Tasks, aiInsight, overdue, expectations, debuff }) {
  const blocks = [];

  // ── Заголовок ──────────────────────────────────────────────────────────────
  blocks.push(B.heading(
    debuff
      ? T.cat('☀️ Утренний брифинг · ', T.bold(date), ' · ', T.mark('⚠️ DEBUFF'))
      : T.cat('☀️ Утренний брифинг · ', T.bold(date))
  ));

  // ── Блок здоровья ──────────────────────────────────────────────────────────
  if (health?.hrv || health?.sleep) {
    const hrvColor = (health.hrv || 0) >= 60 ? '✅' : (health.hrv || 0) >= 40 ? '🟡' : '🔴';
    const sleepColor = (health.sleep || 0) >= 7 ? '✅' : (health.sleep || 0) >= 5 ? '🟡' : '🔴';
    const rcLabel = health.rcLabel || (health.rc >= 1.1 ? '🚀 Высокий' : health.rc >= 0.8 ? '⚡ Норма' : '🐢 Низкий');

    blocks.push(B.table([
      // Заголовок таблицы
      [
        { text: '❤️ HRV',   bold: true, align: 'center' },
        { text: '🌙 Сон',   bold: true, align: 'center' },
        { text: '⚡ RC',    bold: true, align: 'center' },
      ],
      // Данные
      [
        { text: `${hrvColor} ${health.hrv || '—'} мс`,   align: 'center' },
        { text: `${sleepColor} ${health.sleep || '—'} ч`, align: 'center' },
        { text: rcLabel,                                    align: 'center' },
      ],
    ]));

    if (debuff) {
      blocks.push(B.quote(
        T.bold('⚠️ КРИТИЧЕСКИЙ РЕЖИМ: HRV < 30 мс. Сегодня — только рутина и восстановление. Никаких сложных решений.')
      ));
    }
  }

  blocks.push(B.divider());

  // ── Фокус Q1 ──────────────────────────────────────────────────────────────
  if (q1Tasks?.length > 0) {
    blocks.push(B.heading(T.cat('⚡ ', T.bold('Фокус — ШТУРМ'))));
    blocks.push(B.list(q1Tasks.slice(0, 5).map(t => ({
      text: T.bold(t.text),
      sub:  `+${t.xp || 20} XP · ${t.cat || '—'}`,
    }))));
  }

  // ── Q2-задачи ──────────────────────────────────────────────────────────────
  if (q2Tasks?.length > 0) {
    blocks.push(B.details(
      T.cat('🏔️ ', T.italic('Рост (Q2)')),
      [B.list(q2Tasks.slice(0, 3).map(t => `${t.text} · +${t.xp || 15} XP`))],
      false
    ));
  }

  // ── AI-инсайт ─────────────────────────────────────────────────────────────
  if (aiInsight) {
    blocks.push(B.divider());
    blocks.push(B.pullquote(T.italic(aiInsight)));
  }

  // ── Ожидания ──────────────────────────────────────────────────────────────
  if (expectations?.length > 0) {
    const expItems = expectations.map(e => {
      const urgency = e.daysLeft < 0 ? '🔴' : e.daysLeft === 0 ? '🟡' : '🟢';
      const when = e.daysLeft < 0
        ? `просрочено ${Math.abs(e.daysLeft)} дн.`
        : e.daysLeft === 0 ? 'сегодня'
        : `через ${e.daysLeft} дн.`;
      return `${urgency} ${e.what} ← ${e.ownerName} (${when})`;
    });
    blocks.push(B.details(
      T.cat('🕐 Жду от других (', T.bold(String(expectations.length)), ')'),
      [B.list(expItems)],
      expectations.some(e => e.daysLeft <= 0)  // открыто если есть просроченные
    ));
  }

  // ── Просроченные задачи ───────────────────────────────────────────────────
  if (overdue?.length > 0) {
    const overdueItems = overdue.map(t => ({
      text:  T.cat(T.bold(t.text)),
      sub:   `висит ${t.daysAgo || 1} дн. · T:${t.defer_count || 0}`,
    }));
    blocks.push(B.details(
      T.cat('🔴 Висит со вчера (', T.bold(String(overdue.length)), ')'),
      [B.list(overdueItems)],
      true  // раскрыто
    ));
  }

  return blocks;
}

/**
 * Шаблон вечернего чекина
 * @param {object} params
 * @param {string}  params.date
 * @param {number}  params.done         — задач выполнено
 * @param {number}  params.xp           — XP заработано
 * @param {number}  params.q1Closed     — Q1 закрыто
 * @param {number}  params.streak       — стрик
 * @param {string}  params.topTomorrow  — главная задача на завтра
 * @returns {InputRichBlock[]}
 */
export function checkinBlocks({ date, done, xp, q1Closed, streak, topTomorrow }) {
  return [
    B.heading(T.cat('🌙 Итоги дня · ', T.bold(date))),

    B.table([
      [
        { text: '✅ Задач',  bold: true, align: 'center' },
        { text: '⚡ XP',     bold: true, align: 'center' },
        { text: '🎯 Q1',    bold: true, align: 'center' },
        { text: '🔥 Стрик', bold: true, align: 'center' },
      ],
      [
        { text: String(done    || 0), align: 'center' },
        { text: `+${xp        || 0}`, align: 'center' },
        { text: String(q1Closed|| 0), align: 'center' },
        { text: `${streak      || 1} 🔥`, align: 'center' },
      ],
    ]),

    ...(done > 0 ? [B.para(
      done >= 5
        ? T.bold('🏆 Мощный день! Ты закрыл ' + done + ' задач. Заслуженный отдых.')
        : done >= 2
        ? T.italic('Неплохой день. Завтра добавишь ещё немного.')
        : T.italic('Тяжёлый день, но ты справился. Главное — не ноль.')
    )] : []),

    B.divider(),

    B.heading(T.cat('📝 ', T.bold('Как прошёл день?'))),
    B.para('Расскажи голосом или текстом — что удалось, где затупил, что поменяешь.'),

    ...(topTomorrow ? [
      B.divider(),
      B.quote(T.cat('☀️ Завтра начать с: ', T.bold(topTomorrow))),
    ] : []),
  ];
}

/**
 * Шаблон уведомления о выполнении задачи с XP
 * @param {object} p
 * @param {string} p.taskText
 * @param {number} p.xpEarned
 * @param {number} p.totalXP
 * @param {number} p.level
 * @param {number} p.xpToNextLevel
 * @param {boolean} p.energyBonus   — ×1.5 бонус за HRV < 30
 * @param {number}  p.streak
 * @returns {InputRichBlock[]}
 */
export function xpCelebrationBlocks({ taskText, xpEarned, totalXP, level, xpToNextLevel, energyBonus, streak }) {
  const blocks = [
    B.heading(T.cat('✅ ', T.bold('Задача закрыта!'))),
    B.para(T.italic(taskText)),
    B.divider(),
  ];

  // XP строка
  const xpLine = energyBonus
    ? T.cat(T.bold(`+${xpEarned} XP`), T.text(' '), T.mark('×1.5 сверхусилие 💪'))
    : T.bold(`+${xpEarned} XP`);

  blocks.push(B.para(xpLine));

  // Мини-таблица прогресса
  blocks.push(B.table([
    [
      { text: 'Уровень',    bold: true, align: 'center' },
      { text: 'Всего XP',  bold: true, align: 'center' },
      { text: 'До след.',  bold: true, align: 'center' },
      { text: 'Стрик',     bold: true, align: 'center' },
    ],
    [
      { text: `⚔️ ${level}`,         align: 'center' },
      { text: String(totalXP),        align: 'center' },
      { text: `${xpToNextLevel} XP`, align: 'center' },
      { text: `${streak} 🔥`,        align: 'center' },
    ],
  ]));

  return blocks;
}
