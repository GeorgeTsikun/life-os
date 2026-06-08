// ── NOTION — твоё хранилище знаний ───────────────────────────────────────────
// Пишет в твои существующие базы данных в Master Databases:
//   task          → ✅ Tasks  (как «📥 Входящие» — ты сам распределяешь)
//   idea          → 💡 Ideas (как «💡 Сырая»)
//   decision      → 🔑 Decisions (как «🟢 Активно»)
//   meeting_notes → 📝 Meeting Notes
//
// waiting / mood / question / checkin — не пишем (это в Supabase или нигде).

import { Client } from '@notionhq/client';

const TOKEN = process.env.NOTION_TOKEN;
export const notionАктивен = () => !!TOKEN;

// ── ID БАЗ ДАННЫХ (из твоего Master Databases) ───────────────────────────────
// Старые базы Tasks/Ideas/CRM создавались давно, до интеграции LIFE OS BOT —
// Notion не пропагирует доступ на pre-existing databases (известный quirk).
// Поэтому для них созданы свежие копии с суффиксом "(Bot)" — они автоматом
// унаследовали доступ интеграции, так как создавались уже после её появления.
const БАЗЫ = {
  tasks:     'f21760cf-682e-4f3b-ad63-a0c72bfc945f',   // ✅ Tasks (Bot)
  ideas:     'b6536d16-46e1-4db9-b385-b3e8f7a50d77',   // 💡 Ideas (Bot)
  crm:       '890adb1d-4cfa-4f0c-a1ce-62aee43c58db',   // 💰 CRM — бот пока не пишет
  meetings:  '35f51507-ca79-4745-8643-295f7473fd3e',   // 📝 Meeting Notes
  decisions: 'f5dcabfb-4bb2-4c5f-a657-476256145334',   // 🔑 Decisions
};

let notion = null;
if (notionАктивен()) notion = new Client({ auth: TOKEN });

// ── УТИЛИТЫ ───────────────────────────────────────────────────────────────────
const сегодня = () => new Date().toISOString().split('T')[0];

const text = (s, n = 2000) => [{ type: 'text', text: { content: String(s || '').slice(0, n) } }];

function параграфы(полнТекст) {
  const блоки = [];
  for (let i = 0; i < полнТекст.length; i += 2000) {
    блоки.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: полнТекст.slice(i, i + 2000) } }] },
    });
  }
  return блоки;
}

// ── МАППИНГ КАТЕГОРИЙ ─────────────────────────────────────────────────────────
const КАТЕГОРИИ_ИДЕЙ   = { 'Бизнес':'Бизнес', 'Продукт':'Продукт', 'Контент':'Контент', 'Личное':'Личное',
                            'Здоровье':'Личное', 'Деньги':'Бизнес', 'Клуб':'Бизнес', 'Стратегия':'Бизнес' };
const КАТЕГОРИИ_РЕШЕНИЙ = { 'Бизнес':'Бизнес', 'Продукт':'Продукт', 'Личное':'Личное',
                             'Финансы':'Финансы', 'Деньги':'Финансы', 'Стратегия':'Стратегия',
                             'Здоровье':'Личное' };
const ТИПЫ_ВСТРЕЧ     = { 'созвон':'Созвон', 'офлайн':'Офлайн', 'мастермайнд':'Мастермайнд', 'неформал':'Неформал' };

function мапПриоритет(cat, quadrant) {
  // Твой Приоритет: 💰 Деньги / 🚀 Рост / ⚙️ Поддержка — не совпадает с матрицей Эйзенхауэра
  if (['Деньги', 'Бизнес'].includes(cat)) return '💰 Деньги';
  if (['Клуб', 'Контент', 'Стратегия'].includes(cat)) return '🚀 Рост';
  if (['Юрид.', 'Здоровье', 'Личное'].includes(cat)) return '⚙️ Поддержка';
  return null;
}

function мапТип(cat) {
  if (['Бизнес', 'Деньги'].includes(cat)) return 'Продажа';
  if (cat === 'Контент') return 'Контент';
  if (['Клуб', 'Стратегия', 'Юрид.'].includes(cat)) return 'Система';
  return null;
}

// ── ЗАДАЧА → ✅ Tasks ────────────────────────────────────────────────────────
async function записатьЗадачу(разбор, исходный) {
  const извл = разбор.извлечено || {};
  const props = {
    'Название': { title: text(извл.text || исходный.slice(0, 100)) },
    'Статус':   { select: { name: '📥 Входящие' } }, // твоё правило: «Всё сначала → Inbox»
    'Заметки':  { rich_text: text(`Из голосового: ${исходный}`) },
  };
  const приор = мапПриоритет(извл.cat, извл.quadrant);
  if (приор) props['Приоритет'] = { select: { name: приор } };
  const тип = мапТип(извл.cat);
  if (тип) props['Тип'] = { select: { name: тип } };

  const стр = await notion.pages.create({
    parent: { database_id: БАЗЫ.tasks },
    properties: props,
  });
  return стр.id;
}

// ── ИДЕЯ → 💡 Ideas ───────────────────────────────────────────────────────────
async function записатьИдею(разбор, исходный) {
  const извл = разбор.извлечено || {};
  const props = {
    'Название': { title: text(извл.text || исходный.slice(0, 100)) },
    'Статус':   { select: { name: '💡 Сырая' } },
    'Заметки':  { rich_text: text(`Из голосового: ${исходный}`) },
  };
  const кат = КАТЕГОРИИ_ИДЕЙ[извл.cat || извл.категория] || 'Бизнес';
  props['Категория'] = { select: { name: кат } };

  const стр = await notion.pages.create({
    parent: { database_id: БАЗЫ.ideas },
    properties: props,
    children: параграфы(исходный),
  });
  return стр.id;
}

// ── РЕШЕНИЕ → 🔑 Decisions ───────────────────────────────────────────────────
async function записатьРешение(разбор, исходный) {
  const извл = разбор.извлечено || {};
  const props = {
    'Решение':   { title: text(извл.text || исходный.slice(0, 100)) },
    'Дата':      { date: { start: сегодня() } },
    'Категория': { select: { name: КАТЕГОРИИ_РЕШЕНИЙ[извл.cat || извл.категория] || 'Бизнес' } },
    'Почему':    { rich_text: text(извл.контекст || извл.почему || извл.context || '') },
    'Альтернативы': { rich_text: text(извл.альтернативы || '') },
    'Результат': { rich_text: text('') },
    'Статус':    { select: { name: '🟢 Активно' } },
  };
  const стр = await notion.pages.create({
    parent: { database_id: БАЗЫ.decisions },
    properties: props,
    children: параграфы(исходный),
  });
  return стр.id;
}

// ── ЗАМЕТКИ ВСТРЕЧИ → 📝 Meeting Notes ───────────────────────────────────────
async function записатьВстречу(разбор, исходный) {
  const извл = разбор.извлечено || {};
  const участники = Array.isArray(извл.участники || извл.participants)
    ? (извл.участники || извл.participants).join(', ')
    : (извл.участники || извл.participants || '');
  const типВстречи = ТИПЫ_ВСТРЕЧ[String(извл.тип_встречи || 'созвон').toLowerCase()] || 'Созвон';

  const props = {
    'Встреча':   { title: text(извл.title || извл.text || исходный.slice(0, 80) || 'Встреча') },
    'Дата':      { date: { start: сегодня() } },
    'Тип':       { select: { name: типВстречи } },
    'Участники': { rich_text: text(участники) },
    'Решения':   { rich_text: text(извл.решения || извл.decisions || '') },
    'Действия':  { rich_text: text(извл.действия || извл.actions || '') },
  };
  const стр = await notion.pages.create({
    parent: { database_id: БАЗЫ.meetings },
    properties: props,
    children: параграфы(исходный),
  });
  return стр.id;
}

// ── РОУТЕР: куда положить по типу ─────────────────────────────────────────────
export async function сохранитьВNotion(разбор, исходныйТекст /*, источник */) {
  if (!notionАктивен()) return { записал: null, база: null };

  try {
    let id = null;
    let база = null;
    switch (разбор.тип) {
      case 'task':
        id = await записатьЗадачу(разбор, исходныйТекст); база = '✅ Tasks'; break;
      case 'idea':
        id = await записатьИдею(разбор, исходныйТекст); база = '💡 Ideas'; break;
      case 'decision':
        id = await записатьРешение(разбор, исходныйТекст); база = '🔑 Decisions'; break;
      case 'meeting_notes':
        id = await записатьВстречу(разбор, исходныйТекст); база = '📝 Meeting Notes'; break;
      // waiting / mood / question / checkin — не пишем в Notion
    }
    if (id) console.log(`[notion] ✓ ${база} ← ${id}`);
    return { записал: id, база };
  } catch (err) {
    console.error('[notion] ошибка:',
      JSON.stringify({ code: err.code, status: err.status, message: err.message, body: err.body }, null, 2));
    return { записал: null, база: null };
  }
}

// Совместимость со старым API
export async function поднятьБазы() {
  if (!notionАктивен()) {
    console.log('[notion] NOTION_TOKEN не задан');
    return false;
  }
  console.log('[notion] подключено, пишем в:');
  Object.entries(БАЗЫ).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  return true;
}
export const убедитьсяЧтоГотов = поднятьБазы;
export function idБаз() { return БАЗЫ; }
