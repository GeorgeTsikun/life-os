// ── LIFE OS — Богатые отчёты для Telegram-бота ───────────────────────────────
// Дашборд · Канбан · План дня · Итог дня.
// Строит блоки Rich Message (Bot API 10.1) + Markdown-фоллбэк, тянет данные из
// Supabase (owner='george', single-user) и шлёт через sendRichWithFallback.
//
// Используется из index.js (команды + инлайн-кнопки + естественный текст)
// и из scheduling.js (авто план дня утром / итог дня вечером).

import { InlineKeyboard } from 'grammy';
import { sendRichWithFallback, T, B } from './rich.js';

// ── Утилиты ───────────────────────────────────────────────────────────────────
const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;

function сегодняМосква() {
  return new Date(Date.now() + MOSCOW_OFFSET).toISOString().split('T')[0];
}

function датаЧеловеку() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow',
  });
}

// Токен берём устойчиво: основной env бота — TELEGRAM_BOT_TOKEN
function токен() {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
}

const ИКОНКА_КАТЕГОРИИ = {
  'Работа':'💼', 'Контент':'🎬', 'Эксперименты':'🧪', 'Семья':'❤️',
  'Встречи':'🤝', 'Быт':'🏠', 'Стратегия':'🧭', 'Обучение':'📚',
  'Деньги':'💰', 'Здоровье':'🩺', 'Chill':'🌴',
};
const эмодзиКат = (cat) => ИКОНКА_КАТЕГОРИИ[cat] || '•';

// 4 колонки канбана = квадранты матрицы (как в остальном боте)
const КОЛОНКИ = [
  { key: 'do',        name: '⚡ ШТУРМ',   open: true  },
  { key: 'schedule',  name: '🏔️ РОСТ',    open: true  },
  { key: 'delegate',  name: '⚙️ РУТИНА',  open: false },
  { key: 'eliminate', name: '🌀 ЛОВУШКА', open: false },
];

// Время из start_iso → «HH:MM» по Москве (start_iso трактуем как мск-локальное)
function времяИз(start_iso) {
  if (!start_iso || !start_iso.includes('T')) return null;
  const iso = /[zZ]|[+\-]\d{2}:\d{2}$/.test(start_iso) ? start_iso : start_iso + '+03:00';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return null;
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
}

// Кнопка «открыть приложение» (безКэша опционально)
function вебКнопка(безКэша, доп = '', label = '⚡ Открыть LIFE OS') {
  const kb = new InlineKeyboard();
  if (безКэша) kb.webApp(label, безКэша(доп));
  return kb;
}

// ════════════════════════════════════════════════════════════════════════════
// 📊 ДАШБОРД
// ════════════════════════════════════════════════════════════════════════════

const ШКАЛЫ = [
  { key: 'STR', label: '💪 STR' },
  { key: 'VIT', label: '❤️ VIT' },
  { key: 'SOC', label: '🤝 SOC' },
  { key: 'WIS', label: '🧠 WIS' },
  { key: 'ENG', label: '⚡ ENG' },
];

function статусШкалы(v) {
  if (v == null) return '—';
  if (v < 30) return '🔴';
  if (v < 60) return '🟡';
  return '🟢';
}

export function dashboardBlocks({ profile, health, counts }) {
  const blocks = [];
  blocks.push(B.heading(T.cat('📊 ', T.bold('Дашборд · ' + датаЧеловеку()))));

  // RPG-шкалы
  const rpg = profile?.rpg_stats || {};
  const есть = ШКАЛЫ.some(s => rpg[s.key] != null || rpg[s.key.toLowerCase()] != null);
  if (есть) {
    const зн = (k) => rpg[k] ?? rpg[k.toLowerCase()] ?? null;
    blocks.push(B.table([
      ШКАЛЫ.map(s => ({ text: s.label, bold: true, align: 'center' })),
      ШКАЛЫ.map(s => {
        const v = зн(s.key);
        const cell = `${статусШкалы(v)} ${v ?? '—'}`;
        return { text: v != null && v < 30 ? cell : cell, align: 'center' };
      }),
    ]));
  }

  // Уровень / XP / Стрик / RC
  const lvl = profile?.level ?? '—';
  const xp = profile?.xp ?? 0;
  const streak = profile?.streak ?? 0;
  let rc = null, rcLabel = '—';
  if (health?.hrv && health?.sleep) {
    rc = (health.sleep / 8) * (health.hrv / 55);
    rcLabel = rc >= 1.1 ? '🚀 Высокий' : rc >= 0.8 ? '⚡ Норма' : '🐢 Низкий';
  }
  blocks.push(B.table([
    [
      { text: '⚔️ Уровень', bold: true, align: 'center' },
      { text: '✨ XP',       bold: true, align: 'center' },
      { text: '🔥 Стрик',   bold: true, align: 'center' },
      { text: '⚡ RC',       bold: true, align: 'center' },
    ],
    [
      { text: String(lvl),         align: 'center' },
      { text: String(xp),          align: 'center' },
      { text: `${streak} 🔥`,      align: 'center' },
      { text: rc != null ? `${rcLabel} (${rc.toFixed(2)})` : '—', align: 'center' },
    ],
  ]));

  blocks.push(B.divider());

  // Счётчики задач
  blocks.push(B.para(T.cat(
    T.bold('Задачи: '),
    T.text(`активных ${counts.active} · `),
    T.text(`штурм ${counts.q1} · `),
    T.text(`закрыто сегодня ${counts.doneToday}`),
  )));

  if (health?.hrv) {
    const hrvC = health.hrv >= 60 ? '✅' : health.hrv >= 40 ? '🟡' : '🔴';
    blocks.push(B.para(T.text(`❤️ HRV ${hrvC} ${health.hrv}мс · 🌙 Сон ${health.sleep ?? '—'}ч`)));
  }

  return blocks;
}

function dashboardMarkdown({ profile, health, counts }) {
  const lines = [`📊 *Дашборд · ${датаЧеловеку()}*`, ''];
  lines.push(`⚔️ Уровень *${profile?.level ?? '—'}* · ✨ ${profile?.xp ?? 0} XP · 🔥 ${profile?.streak ?? 0}`);
  if (health?.hrv && health?.sleep) {
    const rc = (health.sleep / 8) * (health.hrv / 55);
    lines.push(`⚡ RC: ${rc.toFixed(2)} · ❤️ HRV ${health.hrv}мс · 🌙 ${health.sleep}ч`);
  }
  lines.push('', `📋 Активных: *${counts.active}* · ⚡ Штурм: ${counts.q1} · ✅ Сегодня: ${counts.doneToday}`);
  return lines.join('\n');
}

export async function отправитьДашборд({ supa, chatId, безКэша }) {
  const сегодня = сегодняМосква();
  let profile = null, health = null;
  const counts = { active: 0, q1: 0, doneToday: 0 };

  if (supa) {
    const [pRes, hRes, tRes, dRes] = await Promise.all([
      supa.from('profile').select('xp,level,streak,name,rpg_stats').eq('owner', 'george').maybeSingle(),
      supa.from('health_metrics').select('hrv_ms,sleep_h,resting_hr,steps')
        .eq('owner', 'george').order('date', { ascending: false }).limit(1).maybeSingle(),
      supa.from('tasks').select('quadrant').eq('owner', 'george').eq('done', false).eq('cancelled', false),
      supa.from('tasks').select('id').eq('owner', 'george').eq('done', true)
        .gte('completed_at', `${сегодня}T00:00:00`).lte('completed_at', `${сегодня}T23:59:59`),
    ]);
    profile = pRes.data || null;
    if (hRes.data) health = { hrv: hRes.data.hrv_ms, sleep: hRes.data.sleep_h };
    const активные = tRes.data || [];
    counts.active = активные.length;
    counts.q1 = активные.filter(t => t.quadrant === 'do').length;
    counts.doneToday = (dRes.data || []).length;
  }

  const blocks = dashboardBlocks({ profile, health, counts });
  const md = dashboardMarkdown({ profile, health, counts });
  await sendRichWithFallback(токен(), chatId, blocks, md, {
    reply_markup: вебКнопка(безКэша),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 📋 КАНБАН
// ════════════════════════════════════════════════════════════════════════════

export function kanbanBlocks({ byColumn }) {
  const blocks = [B.heading(T.cat('📋 ', T.bold('Канбан · ' + датаЧеловеку())))];

  let всего = 0;
  for (const col of КОЛОНКИ) {
    const задачи = byColumn[col.key] || [];
    всего += задачи.length;
    const заголовок = T.cat(col.name, ' (', T.bold(String(задачи.length)), ')');
    if (!задачи.length) {
      blocks.push(B.details(заголовок, [B.para(T.italic('пусто'))], false));
      continue;
    }
    const items = задачи.slice(0, 12).map(t => ({
      text: T.bold(t.text),
      sub: `${эмодзиКат(t.cat)} ${t.cat || '—'} · +${t.xp_value || 0} XP`,
    }));
    blocks.push(B.details(заголовок, [B.list(items)], col.open && задачи.length > 0));
  }

  if (всего === 0) {
    blocks.push(B.para(T.italic('Доска пустая — закинь задачу голосом или текстом.')));
  }
  return blocks;
}

function kanbanMarkdown({ byColumn }) {
  const lines = [`📋 *Канбан · ${датаЧеловеку()}*`];
  for (const col of КОЛОНКИ) {
    const задачи = byColumn[col.key] || [];
    lines.push('', `*${col.name}* (${задачи.length})`);
    if (!задачи.length) { lines.push('_пусто_'); continue; }
    задачи.slice(0, 12).forEach(t => lines.push(`• ${t.text} _(${t.cat || '—'})_`));
  }
  return lines.join('\n');
}

export async function отправитьКанбан({ supa, chatId, безКэша }) {
  const byColumn = { do: [], schedule: [], delegate: [], eliminate: [] };
  if (supa) {
    const { data } = await supa.from('tasks')
      .select('id,text,quadrant,cat,xp_value')
      .eq('owner', 'george').eq('done', false).eq('cancelled', false)
      .limit(200);
    for (const t of data || []) {
      (byColumn[t.quadrant] || byColumn.schedule).push(t);
    }
  }
  const blocks = kanbanBlocks({ byColumn });
  const md = kanbanMarkdown({ byColumn });
  await sendRichWithFallback(токен(), chatId, blocks, md, {
    reply_markup: вебКнопка(безКэша),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 🗓 ПЛАН ДНЯ
// ════════════════════════════════════════════════════════════════════════════

export function dayPlanBlocks({ timed, untimed, focus }) {
  const blocks = [B.heading(T.cat('🗓 ', T.bold('План на ' + датаЧеловеку())))];

  if (!timed.length && !untimed.length) {
    blocks.push(B.para(T.italic('На сегодня задач нет. Чистый день 🌤')));
    return blocks;
  }

  if (timed.length) {
    blocks.push(B.heading(T.cat('⏰ ', T.bold('Расписание'))));
    blocks.push(B.list(timed.map(t => ({
      text: T.cat(T.bold(t.time + ' — '), T.text(t.text)),
      sub: `${эмодзиКат(t.cat)} ${t.cat || '—'} · ${t.duration_min || 60} мин`,
    })), true));
  }

  if (untimed.length) {
    blocks.push(B.details(
      T.cat('📌 Без времени (', T.bold(String(untimed.length)), ')'),
      [B.list(untimed.slice(0, 15).map(t => `${эмодзиКат(t.cat)} ${t.text}`))],
      timed.length === 0,
    ));
  }

  if (focus.length) {
    blocks.push(B.divider());
    blocks.push(B.pullquote(T.cat('🎯 Фокус дня: ', T.bold(focus.map(t => t.text).join(' · ')))));
  }
  return blocks;
}

function dayPlanMarkdown({ timed, untimed, focus }) {
  const lines = [`🗓 *План на ${датаЧеловеку()}*`];
  if (!timed.length && !untimed.length) { lines.push('', '_Задач на сегодня нет._'); return lines.join('\n'); }
  if (timed.length) {
    lines.push('', '*⏰ Расписание:*');
    timed.forEach(t => lines.push(`• *${t.time}* — ${t.text} _(${t.duration_min || 60} мин)_`));
  }
  if (untimed.length) {
    lines.push('', '*📌 Без времени:*');
    untimed.slice(0, 15).forEach(t => lines.push(`• ${t.text}`));
  }
  if (focus.length) lines.push('', `🎯 *Фокус:* ${focus.map(t => t.text).join(' · ')}`);
  return lines.join('\n');
}

export async function отправитьПланДня({ supa, chatId, безКэша }) {
  const сегодня = сегодняМосква();
  let задачи = [];
  if (supa) {
    const { data } = await supa.from('tasks')
      .select('id,text,quadrant,cat,xp_value,start_iso,due_date,duration_min')
      .eq('owner', 'george').eq('done', false).eq('cancelled', false)
      .or(`due_date.eq.${сегодня},quadrant.eq.do`)
      .limit(60);
    задачи = data || [];
  }

  const timed = [];
  const untimed = [];
  for (const t of задачи) {
    const время = времяИз(t.start_iso);
    if (время) timed.push({ ...t, time: время });
    else untimed.push(t);
  }
  timed.sort((a, b) => (a.start_iso || '').localeCompare(b.start_iso || ''));

  const focus = задачи.filter(t => t.quadrant === 'do')
    .sort((a, b) => (b.xp_value || 0) - (a.xp_value || 0))
    .slice(0, 3);

  const blocks = dayPlanBlocks({ timed, untimed, focus });
  const md = dayPlanMarkdown({ timed, untimed, focus });
  await sendRichWithFallback(токен(), chatId, blocks, md, {
    reply_markup: вебКнопка(безКэша),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 📈 ИТОГ ДНЯ
// ════════════════════════════════════════════════════════════════════════════

export function dayReportBlocks({ stats, done, deferred, summary }) {
  const blocks = [
    B.heading(T.cat('📈 ', T.bold('Итог дня · ' + датаЧеловеку()))),
    B.table([
      [
        { text: '✅ Закрыто', bold: true, align: 'center' },
        { text: '⏭ Перенос',  bold: true, align: 'center' },
        { text: '✨ XP',       bold: true, align: 'center' },
        { text: '⚡ Q1',       bold: true, align: 'center' },
      ],
      [
        { text: String(stats.done),         align: 'center' },
        { text: String(stats.deferred),     align: 'center' },
        { text: `+${stats.xp}`,             align: 'center' },
        { text: `${stats.q1done}/${stats.q1total}`, align: 'center' },
      ],
    ]),
  ];

  if (done.length) {
    blocks.push(B.heading(T.cat('✅ ', T.bold('Сделано'))));
    blocks.push(B.list(done.slice(0, 12).map(t => `${эмодзиКат(t.cat)} ${t.text}`)));
  }
  if (deferred.length) {
    blocks.push(B.details(
      T.cat('⏭ Перенесено (', T.bold(String(deferred.length)), ')'),
      [B.list(deferred.slice(0, 10).map(t => ({ text: T.text(t.text), sub: `перенос ×${t.defer_count}` })))],
      false,
    ));
  }
  if (summary) {
    blocks.push(B.divider());
    blocks.push(B.pullquote(T.italic(summary)));
  }
  return blocks;
}

function dayReportMarkdown({ stats, done, deferred, summary }) {
  const lines = [`📈 *Итог дня · ${датаЧеловеку()}*`, ''];
  lines.push(`✅ Закрыто: *${stats.done}* · ⏭ Перенос: ${stats.deferred} · ✨ +${stats.xp} XP · ⚡ Q1 ${stats.q1done}/${stats.q1total}`);
  if (done.length) { lines.push('', '*Сделано:*'); done.slice(0, 12).forEach(t => lines.push(`• ${t.text}`)); }
  if (deferred.length) { lines.push('', '*Перенесено:*'); deferred.slice(0, 10).forEach(t => lines.push(`• ${t.text} _(×${t.defer_count})_`)); }
  if (summary) lines.push('', `_${summary}_`);
  return lines.join('\n');
}

export async function отправитьОтчётЗаДень({ supa, openai, chatId, безКэша, ДИРЕКТОР_ПРОМТ }) {
  const сегодня = сегодняМосква();
  let done = [], deferred = [], health = null;
  let q1total = 0;

  if (supa) {
    const [dRes, defRes, q1Res, hRes] = await Promise.all([
      supa.from('tasks').select('text,cat,quadrant,xp_value')
        .eq('owner', 'george').eq('done', true)
        .gte('completed_at', `${сегодня}T00:00:00`).lte('completed_at', `${сегодня}T23:59:59`),
      supa.from('tasks').select('text,defer_count')
        .eq('owner', 'george').eq('done', false).eq('cancelled', false)
        .gte('defer_count', 1).order('defer_count', { ascending: false }).limit(10),
      supa.from('tasks').select('id').eq('owner', 'george').eq('done', false)
        .eq('cancelled', false).eq('quadrant', 'do'),
      supa.from('health_metrics').select('hrv_ms,sleep_h')
        .eq('owner', 'george').order('date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    done = dRes.data || [];
    deferred = defRes.data || [];
    q1total = (q1Res.data || []).length;
    if (hRes.data) health = { hrv: hRes.data.hrv_ms, sleep: hRes.data.sleep_h };
  }

  const stats = {
    done: done.length,
    deferred: deferred.length,
    xp: done.reduce((s, t) => s + (t.xp_value || 0), 0),
    q1done: done.filter(t => t.quadrant === 'do').length,
    q1total: q1total + done.filter(t => t.quadrant === 'do').length,
  };

  // GPT-резюме дня
  let summary = '';
  if (openai) {
    const debuff = (health?.hrv || 99) < 30;
    try {
      const r = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ДИРЕКТОР_ПРОМТ },
          { role: 'system', content:
            `Итог дня. Закрыто задач: ${stats.done}, перенесено: ${stats.deferred}, XP: +${stats.xp}.` +
            (health?.hrv ? ` HRV ${health.hrv}мс, сон ${health.sleep}ч.` : '') +
            (debuff ? ' КРИТИЧЕСКИЙ режим (HRV<30): мягкий, защитный тон, похвали за отдых.' : '') +
            ' Напиши 1-2 предложения резюме дня директорским тоном.' },
          { role: 'user', content: 'Резюмируй день.' },
        ],
        temperature: 0.7,
        max_tokens: 120,
      });
      summary = r.choices[0].message.content;
    } catch (err) { console.warn('[report] GPT:', err.message); }
  }

  const blocks = dayReportBlocks({ stats, done, deferred, summary });
  const md = dayReportMarkdown({ stats, done, deferred, summary });
  await sendRichWithFallback(токен(), chatId, blocks, md, {
    reply_markup: вебКнопка(безКэша),
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 💰 ДЕНЬГИ
// ════════════════════════════════════════════════════════════════════════════
function финДнейДоПлатежа(p) {
  const today = new Date(Date.now() + MOSCOW_OFFSET); today.setUTCHours(0,0,0,0);
  if (typeof p.dueIn === 'number') return p.dueIn;
  if (p.day) {
    let d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), p.day));
    if (d < today) d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth()+1, p.day));
    return Math.round((d - today) / 86400000);
  }
  return null;
}
const финFmt = n => (typeof n === 'number' ? n.toLocaleString('ru-RU') + ' ₽' : (n || '—'));

export async function отправитьДеньги({ supa, chatId, безКэша }) {
  let fin = null;
  if (supa) {
    const { data } = await supa.from('finance').select('data').eq('owner', 'george').maybeSingle();
    fin = data?.data || null;
  }
  if (!fin) {
    await sendRichWithFallback(токен(), chatId, [B.heading('💰 Деньги')],
      '💰 *Деньги*\n\nДанные ещё не синхронизированы. Открой вкладку «Деньги» в приложении.', {});
    return;
  }

  const pays = (fin.payments || []).filter(p => p.status !== 'paid');
  const monthlyDue = pays.reduce((s,p)=>s+(p.amount||0),0);
  const debts = (fin.debts || []).filter(d => d.status === 'open');
  const debtsTotal = debts.reduce((s,d)=>s+(d.amount||0),0);
  const expected = (fin.expectedIncome || []).filter(i=>i.status!=='received');
  const expectedTotal = expected.reduce((s,i)=>s+(typeof i.amount==='number'?i.amount:0),0);
  const горящие = pays.map(p=>({p,d:финДнейДоПлатежа(p)})).filter(x=>x.d!=null && x.d<=2).sort((a,b)=>a.d-b.d);
  const лиды = (fin.leads || []).filter(l => l.hot && l.status !== 'contacted');

  const blocks = [
    B.heading(T.cat('💰 ', T.bold('Деньги · ' + датаЧеловеку()))),
    B.table([
      [ {text:'🎯 Цель/мес',bold:true,align:'center'},{text:'📅 Платежи',bold:true,align:'center'},{text:'📈 Ждём',bold:true,align:'center'},{text:'💸 Долги',bold:true,align:'center'} ],
      [ {text:финFmt(fin.incomeGoal),align:'center'},{text:финFmt(monthlyDue),align:'center'},{text:финFmt(expectedTotal),align:'center'},{text:финFmt(debtsTotal),align:'center'} ],
    ]),
  ];
  if (горящие.length) {
    blocks.push(B.heading(T.cat('🔥 ', T.bold('Горящие платежи'))));
    blocks.push(B.list(горящие.map(({p,d}) => ({
      text: T.bold(p.title + ' — ' + финFmt(p.amount)),
      sub: d < 0 ? `просрочено ${-d} дн.` : d === 0 ? 'сегодня' : d === 1 ? 'завтра' : `через ${d} дн.`,
    }))));
  }
  if (expected.length) {
    blocks.push(B.details(T.cat('📈 Ждём прихода (', T.bold(String(expected.length)), ')'),
      [B.list(expected.map(i => `${i.from} — ${финFmt(i.amount)} (${i.when})`))], true));
  }
  if (лиды.length) {
    blocks.push(B.details(T.cat('🔥 Топ-лиды — написать (', T.bold(String(лиды.length)), ')'),
      [B.list(лиды.map(l => l.name))], false));
  }

  const md = [
    `💰 *Деньги · ${датаЧеловеку()}*`,
    `🎯 Цель ${финFmt(fin.incomeGoal)} · 📅 платежи ${финFmt(monthlyDue)} · 📈 ждём ${финFmt(expectedTotal)} · 💸 долги ${финFmt(debtsTotal)}`,
    горящие.length ? `\n🔥 *Горящие:*\n` + горящие.map(({p,d})=>`• ${p.title} — ${финFmt(p.amount)} (${d<0?'просрочено':d===0?'сегодня':d===1?'завтра':d+' дн.'})`).join('\n') : '',
    лиды.length ? `\n🔥 *Написать:* ${лиды.map(l=>l.name).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  await sendRichWithFallback(токен(), chatId, blocks, md, { reply_markup: вебКнопка(безКэша, '?tab=money', '💰 Открыть Деньги') });
}

// ── Роутер для callback rep:* и естественного текста ─────────────────────────
export async function отправитьОтчёт(kind, deps) {
  switch (kind) {
    case 'dashboard':  return отправитьДашборд(deps);
    case 'kanban':     return отправитьКанбан(deps);
    case 'plan':       return отправитьПланДня(deps);
    case 'day_report':
    case 'report':     return отправитьОтчётЗаДень(deps);
    case 'money':      return отправитьДеньги(deps);
    default:           return отправитьДашборд(deps);
  }
}

export { токен as токенБота };
