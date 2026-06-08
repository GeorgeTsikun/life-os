// ── NOTION — твоё хранилище знаний ───────────────────────────────────────────
// При первом запуске создаёт 4 базы данных внутри корневой страницы «LIFE OS»:
//   📥 Входящие   — полный лог всего, что прилетает
//   💡 Идеи        — мысли, которые ещё не задачи
//   📝 Заметки встреч — транскрипты созвонов
//   🔑 Журнал решений — ключевые решения с обоснованием
// Дальше использует кэш ID этих баз.

import { Client } from '@notionhq/client';

const TOKEN = process.env.NOTION_TOKEN;
const ROOT_PAGE_ID = process.env.NOTION_ROOT_PAGE_ID;

export const notionАктивен = () => !!(TOKEN && ROOT_PAGE_ID);

let notion = null;
let базы = {};                                  // имя → id базы данных
let инициализирован = false;

if (notionАктивен()) {
  notion = new Client({ auth: TOKEN });
}

// ── ОПРЕДЕЛЕНИЯ БАЗ ───────────────────────────────────────────────────────────
const ОПРЕДЕЛЕНИЯ = {
  'Входящие': {
    emoji: '📥',
    properties: {
      'Заголовок': { title: {} },
      'Тип':       { select: { options: [
        {name:'task', color:'green'}, {name:'waiting', color:'orange'},
        {name:'idea', color:'purple'}, {name:'decision', color:'red'},
        {name:'meeting_notes', color:'blue'}, {name:'mood', color:'pink'},
        {name:'question', color:'gray'}, {name:'checkin', color:'yellow'},
      ]}},
      'Источник':   { select: { options: [
        {name:'telegram', color:'blue'},
        {name:'mini_app', color:'green'},
        {name:'email', color:'gray'},
      ]}},
      'Дата':       { date: {} },
      'Обработано': { checkbox: {} },
    },
  },
  'Идеи': {
    emoji: '💡',
    properties: {
      'Идея':       { title: {} },
      'Категория':  { select: { options: [
        {name:'Бизнес', color:'green'}, {name:'Продукт', color:'blue'},
        {name:'Контент', color:'orange'}, {name:'Личное', color:'pink'},
        {name:'Здоровье', color:'red'}, {name:'Деньги', color:'yellow'},
      ]}},
      'Статус':     { select: { options: [
        {name:'Новая', color:'gray'},
        {name:'Обдумываю', color:'blue'},
        {name:'Реализую', color:'green'},
        {name:'Отложена', color:'orange'},
        {name:'Отброшена', color:'red'},
      ]}},
      'Дата':       { date: {} },
    },
  },
  'Заметки встреч': {
    emoji: '📝',
    properties: {
      'Встреча':    { title: {} },
      'Дата':       { date: {} },
      'Участники':  { multi_select: { options: [] } },
      'Тип':        { select: { options: [
        {name:'Созвон', color:'blue'}, {name:'Офлайн', color:'green'},
        {name:'Неформал', color:'pink'}, {name:'Мастермайнд', color:'purple'},
      ]}},
      'Действия':   { rich_text: {} },
    },
  },
  'Журнал решений': {
    emoji: '🔑',
    properties: {
      'Решение':    { title: {} },
      'Дата':       { date: {} },
      'Категория':  { select: { options: [
        {name:'Бизнес', color:'green'}, {name:'Личное', color:'pink'},
        {name:'Проект', color:'blue'}, {name:'Финансы', color:'yellow'},
      ]}},
      'Почему':     { rich_text: {} },
      'Результат':  { rich_text: {} },
    },
  },
};

// ── ИНИЦИАЛИЗАЦИЯ — поднимаем недостающие базы ────────────────────────────────
export async function поднятьБазы() {
  if (!notionАктивен()) {
    console.log('[notion] не настроен — пропускаю инициализацию');
    return false;
  }
  if (инициализирован) return true;

  try {
    // Список существующих баз в корневой странице
    const существующие = await notion.blocks.children.list({ block_id: ROOT_PAGE_ID });
    const найденные = {};
    for (const блок of существующие.results) {
      if (блок.type === 'child_database') {
        найденные[блок.child_database.title] = блок.id;
      }
    }

    // Для каждой нужной базы — либо берём существующую, либо создаём
    for (const [имя, опр] of Object.entries(ОПРЕДЕЛЕНИЯ)) {
      if (найденные[имя]) {
        базы[имя] = найденные[имя];
        console.log(`[notion] ✓ уже есть: ${опр.emoji} ${имя}`);
      } else {
        const бд = await notion.databases.create({
          parent: { type: 'page_id', page_id: ROOT_PAGE_ID },
          icon:   { type: 'emoji', emoji: опр.emoji },
          title:  [{ type: 'text', text: { content: имя } }],
          properties: опр.properties,
        });
        базы[имя] = бд.id;
        console.log(`[notion] ✨ создана: ${опр.emoji} ${имя}`);
      }
    }

    инициализирован = true;
    return true;
  } catch (err) {
    console.error('[notion] ошибка инициализации:', err.message);
    return false;
  }
}

// ── УТИЛИТЫ ───────────────────────────────────────────────────────────────────
function сегодня() { return new Date().toISOString().split('T')[0]; }

function текстовыйБлок(текст) {
  return {
    object: 'block',
    type:   'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: текст.slice(0, 2000) } }],
    },
  };
}

function большойТекст(полнТекст) {
  // Notion ограничивает rich_text 2000 символов — режем длинный текст на блоки
  const блоки = [];
  for (let i = 0; i < полнТекст.length; i += 2000) {
    блоки.push(текстовыйБлок(полнТекст.slice(i, i + 2000)));
  }
  return блоки;
}

// ── ЗАПИСЬ ВО «ВХОДЯЩИЕ» (всегда, для всех типов) ─────────────────────────────
export async function записатьВходящее(разбор, исходныйТекст, источник = 'telegram') {
  if (!инициализирован || !базы['Входящие']) return null;
  try {
    const заголовок = краткийЗаголовок(разбор, исходныйТекст);
    const стр = await notion.pages.create({
      parent: { database_id: базы['Входящие'] },
      properties: {
        'Заголовок':  { title:    [{ text: { content: заголовок } }] },
        'Тип':        { select:   { name: разбор.тип || 'question' } },
        'Источник':   { select:   { name: источник } },
        'Дата':       { date:     { start: сегодня() } },
        'Обработано': { checkbox: true },
      },
      children: большойТекст(исходныйТекст),
    });
    return стр.id;
  } catch (err) {
    console.error('[notion inbox]', err.message);
    return null;
  }
}

// ── ИДЕЯ ──────────────────────────────────────────────────────────────────────
export async function записатьИдею(разбор, исходныйТекст) {
  if (!инициализирован || !базы['Идеи']) return null;
  const извл = разбор.извлечено || {};
  try {
    const стр = await notion.pages.create({
      parent: { database_id: базы['Идеи'] },
      properties: {
        'Идея':      { title:  [{ text: { content: (извл.text || исходныйТекст).slice(0, 200) } }] },
        'Категория': { select: { name: извл.cat || извл.категория || 'Бизнес' } },
        'Статус':    { select: { name: 'Новая' } },
        'Дата':      { date:   { start: сегодня() } },
      },
      children: большойТекст(исходныйТекст),
    });
    return стр.id;
  } catch (err) {
    console.error('[notion idea]', err.message);
    return null;
  }
}

// ── РЕШЕНИЕ ───────────────────────────────────────────────────────────────────
export async function записатьРешение(разбор, исходныйТекст) {
  if (!инициализирован || !базы['Журнал решений']) return null;
  const извл = разбор.извлечено || {};
  try {
    const почему = извл.контекст || извл.почему || извл.context || '';
    const стр = await notion.pages.create({
      parent: { database_id: базы['Журнал решений'] },
      properties: {
        'Решение':   { title:     [{ text: { content: (извл.text || исходныйТекст).slice(0, 200) } }] },
        'Дата':      { date:      { start: сегодня() } },
        'Категория': { select:    { name: извл.cat || 'Бизнес' } },
        'Почему':    { rich_text: [{ text: { content: почему.slice(0, 2000) } }] },
        'Результат': { rich_text: [{ text: { content: '' } }] },
      },
      children: большойТекст(исходныйТекст),
    });
    return стр.id;
  } catch (err) {
    console.error('[notion decision]', err.message);
    return null;
  }
}

// ── ЗАМЕТКИ ВСТРЕЧИ ───────────────────────────────────────────────────────────
export async function записатьВстречу(разбор, исходныйТекст) {
  if (!инициализирован || !базы['Заметки встреч']) return null;
  const извл = разбор.извлечено || {};
  const участники = (извл.участники || извл.participants || [])
    .map(п => ({ name: String(п).slice(0, 60) }))
    .slice(0, 10);
  try {
    const стр = await notion.pages.create({
      parent: { database_id: базы['Заметки встреч'] },
      properties: {
        'Встреча':   { title:        [{ text: { content: (извл.title || извл.text || 'Встреча').slice(0, 200) } }] },
        'Дата':      { date:         { start: сегодня() } },
        'Участники': { multi_select: участники },
        'Тип':       { select:       { name: извл.тип_встречи || 'Созвон' } },
        'Действия':  { rich_text:    [{ text: { content: (извл.действия || извл.actions || '').slice(0, 2000) } }] },
      },
      children: большойТекст(исходныйТекст),
    });
    return стр.id;
  } catch (err) {
    console.error('[notion meeting]', err.message);
    return null;
  }
}

// ── РОУТЕР: куда положить по типу ─────────────────────────────────────────────
export async function сохранитьВNotion(разбор, исходныйТекст, источник = 'telegram') {
  if (!инициализирован) return { inbox: null, специфика: null };
  // Во Входящие — ВСЕГДА
  const inboxId = await записатьВходящее(разбор, исходныйТекст, источник);

  let спецификаId = null;
  switch (разбор.тип) {
    case 'idea':          спецификаId = await записатьИдею(разбор, исходныйТекст); break;
    case 'decision':      спецификаId = await записатьРешение(разбор, исходныйТекст); break;
    case 'meeting_notes': спецификаId = await записатьВстречу(разбор, исходныйТекст); break;
  }
  return { inbox: inboxId, специфика: спецификаId };
}

// ── КРАТКИЙ ЗАГОЛОВОК ИЗ КЛАССИФИКАЦИИ ───────────────────────────────────────
function краткийЗаголовок(разбор, исходный) {
  const извл = разбор.извлечено || {};
  return (извл.text || извл.what || извл.title || извл.заголовок ||
          исходный.slice(0, 80) || '(без названия)').slice(0, 200);
}

// ── ID БАЗ — для логирования ─────────────────────────────────────────────────
export function idБаз() { return базы; }
