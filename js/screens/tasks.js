// ── TASKS SCREEN ──────────────────────────────────────────────────────────────
import { DB } from '../db.js?v=30';
import { onTaskToggled } from '../gamification.js?v=30';
import { TG } from '../telegram.js?v=30';
import { парсДату, бакет, форматДата, БАКЕТЫ_UI, ПОРЯДОК_БАКЕТОВ, вISO } from '../utils/date.js';
import { openTaskDetail } from './_taskDetail.js';

const CAT_COLOR = {
  // Основные категории (соответствуют твоим календарям)
  'Работа':       '#00F5D4',
  'Контент':      '#FF9F43',
  'Эксперименты': '#7B61FF',
  'Семья':        '#FF6B6B',
  'Встречи':      '#00C9FF',
  'Быт':          '#FFD700',
  'Стратегия':    '#00E396',
  'Обучение':     '#FFD58A',
  'Деньги':       '#FFD700',
  'Здоровье':     '#FF6B6B',
  'Chill':        '#7B61FF',
  // Совместимость со старыми категориями
  'Бизнес':       '#00F5D4',
  'Клуб':         '#7B61FF',
  'Юрид.':        '#C8D6E5',
  'Ловушка':      'rgba(232,237,245,.3)',
  'Личное':       '#00C9FF',
};

const QUADS = [
  { key:'do',       label:'⚡ ШТУРМ',    sub:'Важно · срочно',    color:'#FF4560', cls:'accent-red'    },
  { key:'schedule', label:'🏔️ РОСТ',     sub:'Двигает к цели',    color:'#00F5D4', cls:'accent-teal'   },
  { key:'delegate', label:'⚙️ РУТИНА',   sub:'Бытовая механика',  color:'#7B61FF', cls:'accent-violet' },
  { key:'eliminate',label:'🌀 ЛОВУШКА',  sub:'Ворует время',      color:'rgba(232,237,245,.35)',cls:'accent-gray'},
];

let viewMode   = 'dates'; // 'dates' | 'matrix' | 'done' | 'ideas' | 'kanban'
let catFilter  = 'all';  // 'all' | 'work' | 'personal' | 'cat:X'
let kbExpanded = null;   // id раскрытой kanban-карточки

const WORK_CATS_T = new Set(['Работа','Контент','Эксперименты','Стратегия','Обучение','Деньги','Бизнес','Клуб','Операционка','Привлечение клиентов','Развитие','Эффективность']);
const LIFE_CATS_T = new Set(['Семья','Встречи','Быт','Здоровье','Chill','Личное','Личные дела','Домашние дела']);
const ALL_CATS_T  = ['Работа','Контент','Эксперименты','Семья','Встречи','Быт','Стратегия','Обучение','Деньги','Здоровье','Chill','Личное'];

function applyCatFilter(tasks) {
  if (catFilter === 'work')     return tasks.filter(t => WORK_CATS_T.has(t.cat));
  if (catFilter === 'personal') return tasks.filter(t => LIFE_CATS_T.has(t.cat) || (!WORK_CATS_T.has(t.cat) && !LIFE_CATS_T.has(t.cat)));
  if (catFilter.startsWith('cat:')) return tasks.filter(t => t.cat === catFilter.slice(4));
  return tasks;
}

export function renderTasks() {
  const tasks    = DB.getTasks();
  const активные = tasks.filter(t => !t.done && !t.cancelled);
  const готовые  = tasks.filter(t => t.done);
  const filtered = catFilter !== 'all' && viewMode !== 'done' ? applyCatFilter(активные) : активные;

  const btnStyle = (f, clr='#00F5D4') => {
    const active = catFilter === f;
    return `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;border:1px solid ${active?`rgba(${clr==='#FF6B6B'?'255,107,107':'0,245,212'},.5)`:'rgba(255,255,255,.12)'};background:${active?`rgba(${clr==='#FF6B6B'?'255,107,107':'0,245,212'},.12)`:'rgba(255,255,255,.04)'};color:${active?clr:'rgba(232,237,245,.5)'}`;
  };

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:12px">
    <div>
      <div class="num" style="font-size:16px">ЗАДАЧИ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${активные.length} активных · ${готовые.length} готовых</div>
    </div>
    <button class="btn btn-teal" onclick="window.openAddTask()">+ Добавить</button>
  </div>

  <div class="toggle-row" style="margin-bottom:10px">
    <button class="toggle-btn${viewMode==='dates'?' active':''}"  onclick="window.setTaskView('dates')">📅</button>
    <button class="toggle-btn${viewMode==='matrix'?' active':''}" onclick="window.setTaskView('matrix')">🔲</button>
    <button class="toggle-btn${viewMode==='kanban'?' active':''}" onclick="window.setTaskView('kanban')">🗂</button>
    <button class="toggle-btn${viewMode==='done'?' active':''}"   onclick="window.setTaskView('done')">✅</button>
    <button class="toggle-btn${viewMode==='ideas'?' active':''}"  onclick="window.setTaskView('ideas')" style="color:#FFD700">💡</button>
  </div>

  ${viewMode !== 'done' ? `
  <div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;scrollbar-width:none">
    <button onclick="window.setCatFilter('all')"      style="${btnStyle('all')}">Все</button>
    <button onclick="window.setCatFilter('work')"     style="${btnStyle('work')}">💼 Работа</button>
    <button onclick="window.setCatFilter('personal')" style="${btnStyle('personal','#FF6B6B')}">🏠 Личное</button>
    <button onclick="window.toggleTaskCatMenu()"      style="padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;flex-shrink:0;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:rgba(232,237,245,.5)">⚙️</button>
  </div>
  <div id="task-cat-menu" style="display:none;flex-wrap:wrap;gap:5px;margin-bottom:10px">
    ${ALL_CATS_T.map(c => `<button onclick="window.setCatFilter('cat:${c}')" style="padding:3px 9px;border-radius:14px;font-size:10px;cursor:pointer;border:1px solid ${catFilter==='cat:'+c?'rgba(0,245,212,.5)':'rgba(255,255,255,.1)'};background:${catFilter==='cat:'+c?'rgba(0,245,212,.15)':'rgba(255,255,255,.03)'};color:${catFilter==='cat:'+c?'#00F5D4':'rgba(232,237,245,.45)'}">${c}</button>`).join('')}
  </div>` : ''}

  ${viewMode === 'matrix' ? renderMatrix(filtered)
   : viewMode === 'done'  ? renderDone(готовые)
   : viewMode === 'ideas' ? renderIdeaBank()
   : viewMode === 'kanban'? renderKanban()
   : renderByDates(filtered)}

  <div style="height:8px"></div>
</div>`;

  TG.hideMainButton();
  TG.hideBackButton();

  // Dot-индикатор скролла канбана
  if (viewMode === 'kanban') {
    requestAnimationFrame(() => {
      const wrap = document.getElementById('kanban-scroll');
      if (!wrap || wrap._kbListener) return;
      wrap._kbListener = true;
      wrap.addEventListener('scroll', () => {
        const idx = Math.round(wrap.scrollLeft / 220);
        document.querySelectorAll('.kanban-hint-dot').forEach((d, i) => {
          d.classList.toggle('active', i === idx);
        });
      }, { passive: true });
    });
  }
}

// ── ГРУППИРОВКА ПО ДАТАМ ─────────────────────────────────────────────────────
function renderByDates(tasks) {
  if (tasks.length === 0) {
    return `<div style="text-align:center;padding:40px 20px;color:rgba(232,237,245,.4)">
      <div style="font-size:48px;margin-bottom:12px">✨</div>
      <div style="font-size:13px">Активных задач нет</div>
      <div style="font-size:11px;margin-top:8px">Скажи боту голосом или жми + Добавить</div>
    </div>`;
  }

  // Группируем по бакетам
  const группы = Object.fromEntries(ПОРЯДОК_БАКЕТОВ.map(к => [к, []]));
  for (const t of tasks) {
    const дата = t.start_iso ? new Date(t.start_iso)
               : t.due_date  ? new Date(t.due_date)
               : парсДату(t.time);
    const б = бакет(дата);
    группы[б].push({ ...t, _дата: дата });
  }

  // Сортировка внутри: просрочено сверху, остальное по дате возрастанию
  Object.values(группы).forEach(arr => arr.sort((a,b) => {
    if (!a._дата) return 1;
    if (!b._дата) return -1;
    return a._дата - b._дата;
  }));

  return ПОРЯДОК_БАКЕТОВ.map(к => {
    const items = группы[к];
    if (items.length === 0) return '';
    const ui = БАКЕТЫ_UI[к];
    return `<div class="card" style="margin-bottom:12px;border-top:2px solid ${ui.color}">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:10px;font-weight:700;color:${ui.color};letter-spacing:.05em">${ui.label}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:1px">${ui.sub}</div>
        </div>
        <span class="num" style="font-size:14px;color:${ui.color}">${items.length}</span>
      </div>
      ${items.map(t => taskItemHTML(t, ui.color)).join('')}
    </div>`;
  }).join('');
}

// ── АРХИВ ГОТОВЫХ ───────────────────────────────────────────────────────────
function renderDone(готовые) {
  const отменённые = готовые.filter(t => t.cancelled);
  const выполненные = готовые.filter(t => !t.cancelled);

  if (готовые.length === 0) {
    return `<div style="text-align:center;padding:40px 20px;color:rgba(232,237,245,.4)">
      <div style="font-size:48px;margin-bottom:12px">📭</div>
      <div style="font-size:13px">Пока пусто</div>
      <div style="font-size:11px;margin-top:8px">Выполненные задачи окажутся здесь</div>
    </div>`;
  }

  // Отменённые — отдельным блоком снизу
  const блокОтменённых = отменённые.length ? `
    <div style="margin-top:8px;margin-bottom:12px">
      <div style="font-size:9px;color:rgba(232,237,245,.3);letter-spacing:.08em;margin-bottom:6px;padding:0 4px">❌ ОТМЕНЁННЫЕ (${отменённые.length})</div>
      ${отменённые.map(t => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);opacity:.5">
          <span style="font-size:12px">❌</span>
          <div style="flex:1;font-size:11px;text-decoration:line-through;color:rgba(232,237,245,.4)">${t.text}</div>
          <span style="font-size:9px;color:rgba(232,237,245,.2)">${t.cat || ''}</span>
        </div>`).join('')}
    </div>` : '';

  готовые = выполненные; // далее рендерим только выполненные
  if (!готовые.length) return блокОтменённых || '';
  // Сортируем по дате выполнения (свежие сверху)
  готовые = [...готовые].sort((a,b) => {
    const da = new Date(a.completedAt || 0).getTime();
    const db = new Date(b.completedAt || 0).getTime();
    return db - da;
  });

  // Группируем по дням
  const поДням = {};
  for (const t of готовые) {
    const date = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
    const ключ = форматДата(date) || 'давно';
    if (!поДням[ключ]) поДням[ключ] = [];
    поДням[ключ].push(t);
  }

  return Object.entries(поДням).map(([день, items]) => `
    <div class="card" style="margin-bottom:12px;border-top:2px solid #00E396">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:10px;font-weight:700;color:#00E396;letter-spacing:.05em">✅ ${день.toUpperCase()}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:1px">${items.length} выполнено</div>
        </div>
        <span class="num" style="font-size:14px;color:#00E396">+${items.length * 50} XP</span>
      </div>
      ${items.map(t => doneItemHTML(t)).join('')}
    </div>
  `).join('') + блокОтменённых;
}

function doneItemHTML(t) {
  const cc = CAT_COLOR[t.cat] || 'rgba(232,237,245,.1)';
  return `<div class="task-item done" style="opacity:.7">
    <div class="checkbox checked" style="background:#00E396;border-color:#00E396;color:#000" onclick="window.toggleTask('${t.id}')">✓</div>
    <div style="flex:1;cursor:pointer" onclick="window.openTaskDetail('${t.id}')">
      <div class="task-text" style="font-size:12px;font-weight:500;text-decoration:line-through">${t.text}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      <span class="badge" style="background:${cc}18;color:${cc};border:1px solid ${cc}30">${t.cat || '—'}</span>
      <button class="btn btn-ghost" style="font-size:9px;padding:2px 6px" onclick="window.toggleTask('${t.id}')">↩ Вернуть</button>
    </div>
  </div>`;
}

function renderIdeaBank() {
  const ideas = DB.getIdeaBank();
  if (!ideas.length) return `<div class="card" style="text-align:center;padding:32px 16px">
    <div style="font-size:36px;margin-bottom:8px">💡</div>
    <div style="font-size:13px;font-weight:700;margin-bottom:4px">Банк идей пуст</div>
    <div style="font-size:11px;color:rgba(232,237,245,.4)">Q4-задачи старше 48ч автоматически<br>попадают сюда</div>
  </div>`;

  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700">💡 Банк идей</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${ideas.length} идей</span>
    </div>
    <div style="font-size:10px;color:rgba(232,237,245,.35);margin-bottom:10px">Q4-задачи, которые не взяли в работу 48ч. Превратите в задачу или удалите.</div>
    ${ideas.map(idea => `
    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:flex-start;gap:10px">
      <div style="font-size:18px;flex-shrink:0;padding-top:1px">💡</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:#E8EDF5;margin-bottom:2px">${idea.text}</div>
        ${idea.cat ? `<span style="font-size:9px;color:#FFD700;background:rgba(255,215,0,.07);padding:2px 7px;border-radius:10px">${idea.cat}</span>` : ''}
        ${idea.notes ? `<div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:3px">${idea.notes}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
        <button onclick="window.ideaBankRevive('${idea.id}')" style="font-size:9px;padding:3px 7px;border-radius:8px;border:1px solid rgba(0,245,212,.3);background:rgba(0,245,212,.06);color:#00F5D4;cursor:pointer">▶ Q1</button>
        <button onclick="window.ideaBankDelete('${idea.id}')" style="font-size:9px;padding:3px 7px;border-radius:8px;border:1px solid rgba(255,69,96,.2);background:rgba(255,69,96,.05);color:#FF4560;cursor:pointer">✕</button>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── KANBAN ─────────────────────────────────────────────────────────────────
const KB_COLS = [
  { id:'inbox',   icon:'📥', title:'Входящие', bg:'rgba(0,201,255,.08)',   border:'rgba(0,201,255,.25)',  color:'#00C9FF', countBg:'rgba(0,201,255,.15)' },
  { id:'working', icon:'⚡',  title:'В работе',  bg:'rgba(255,69,96,.08)',   border:'rgba(255,69,96,.25)',  color:'#FF4560', countBg:'rgba(255,69,96,.15)'  },
  { id:'waiting', icon:'⏳',  title:'Ожидание',  bg:'rgba(255,215,0,.07)',   border:'rgba(255,215,0,.22)',  color:'#FFD700', countBg:'rgba(255,215,0,.14)'  },
  { id:'done',    icon:'✅',  title:'Сделано',   bg:'rgba(0,227,150,.07)',   border:'rgba(0,227,150,.2)',   color:'#00E396', countBg:'rgba(0,227,150,.14)'  },
];

const QUAD_COLOR = { do:'#FF4560', schedule:'#00F5D4', delegate:'#7B61FF', eliminate:'rgba(232,237,245,.3)' };

function renderKanban() {
  const все   = DB.getTasks();
  const сегодня = new Date().toDateString();

  // Распределяем активные по колонкам
  const cols = {
    inbox:   все.filter(t => !t.done && !t.cancelled && (!t.kanban_status || t.kanban_status === 'inbox')),
    working: все.filter(t => !t.done && !t.cancelled && t.kanban_status === 'working'),
    waiting: все.filter(t => !t.done && !t.cancelled && t.kanban_status === 'waiting'),
    done:    все.filter(t => t.done && !t.cancelled && t.completedAt &&
               new Date(t.completedAt).toDateString() === сегодня),
  };

  const colHTML = KB_COLS.map(col => {
    const tasks = cols[col.id];
    const totalXP = tasks.reduce((s, t) => s + (t.xpValue || 0), 0);

    const cardsHTML = tasks.length
      ? tasks.map(t => kbCardHTML(t, col)).join('')
      : `<div class="kb-empty">${col.id === 'done' ? '🏆<br>Пока пусто<br>Выполни задачу!' : '✨<br>Пусто<br>Тяни сюда задачи'}</div>`;

    return `<div class="kanban-col" data-col="${col.id}">
      <div class="kb-head" style="background:${col.bg};border:1px solid ${col.border};border-bottom:none">
        <div class="kb-head-left">
          <span class="kb-head-icon">${col.icon}</span>
          <span class="kb-head-title" style="color:${col.color}">${col.title}</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
          <span class="kb-count" style="background:${col.countBg};color:${col.color}">${tasks.length}</span>
          ${totalXP > 0 ? `<span class="kb-xp-total" style="color:${col.color}">+${totalXP} XP</span>` : ''}
        </div>
      </div>
      <div class="kb-body">${cardsHTML}</div>
    </div>`;
  }).join('');

  return `<div>
    <div class="kanban-hint" id="kb-hint">
      ${KB_COLS.map((c,i) => `<div class="kanban-hint-dot${i===0?' active':''}" id="kbdot-${i}"></div>`).join('')}
    </div>
    <div class="kanban-wrap" id="kanban-scroll">${colHTML}</div>
  </div>`;
}

function kbCardHTML(t, col) {
  const qColor  = QUAD_COLOR[t.quadrant] || '#7B61FF';
  const catColor = CAT_COLOR[t.cat] || 'rgba(232,237,245,.3)';
  const dc       = t.defer_count || 0;
  const deferBadge = dc >= 1
    ? `<span class="kb-chip" style="background:${dc>=3?'rgba(255,69,96,.12)':'rgba(255,159,67,.1)'};color:${dc>=3?'#FF4560':'#FF9F43'};border:1px solid ${dc>=3?'rgba(255,69,96,.3)':'rgba(255,159,67,.25)'}">T:${dc}</span>`
    : '';
  const fiBadge = t.financial_impact === 'direct'
    ? `<span class="kb-chip" style="background:rgba(255,215,0,.1);color:#FFD700;border:1px solid rgba(255,215,0,.25)">💰</span>`
    : t.financial_impact === 'indirect'
    ? `<span class="kb-chip" style="background:rgba(0,227,150,.07);color:#00E396;border:1px solid rgba(0,227,150,.2)">💡</span>`
    : '';

  const isExpanded = kbExpanded === t.id;
  // Кнопки движения зависят от колонки
  const prevCol = col.id === 'working' ? 'inbox' : col.id === 'waiting' ? 'working' : null;
  const nextCol = col.id === 'inbox' ? 'working' : col.id === 'working' ? 'waiting' : null;
  const prevLabel = prevCol === 'inbox' ? '← Входящие' : prevCol === 'working' ? '← В работе' : null;
  const nextLabel = nextCol === 'working' ? 'В работе →' : nextCol === 'waiting' ? 'Ожидание →' : null;

  const actionsHTML = col.id === 'done' ? `
    <div class="kb-actions-inner">
      <div class="kb-btn-row">
        <button class="kb-btn kb-btn-edit" onclick="event.stopPropagation();window.openTaskDetail('${t.id}')">✏️ Открыть</button>
        <button class="kb-btn" onclick="event.stopPropagation();window.toggleTask('${t.id}')">↩ Вернуть</button>
      </div>
    </div>` : `
    <div class="kb-actions-inner">
      <div class="kb-btn-row">
        ${prevLabel ? `<button class="kb-btn" onclick="event.stopPropagation();window.kbMove('${t.id}','${prevCol}')" style="flex:1.4">${prevLabel}</button>` : '<div style="flex:1.4"></div>'}
        <button class="kb-btn kb-btn-done" onclick="event.stopPropagation();window.kbDone('${t.id}')">✓</button>
        ${nextLabel ? `<button class="kb-btn" onclick="event.stopPropagation();window.kbMove('${t.id}','${nextCol}')" style="flex:1.4">${nextLabel}</button>` : '<div style="flex:1.4"></div>'}
      </div>
      <div class="kb-btn-row">
        <button class="kb-btn kb-btn-edit" onclick="event.stopPropagation();window.openTaskDetail('${t.id}')">✏️ Открыть</button>
      </div>
    </div>`;

  return `<div class="kb-card${isExpanded?' kb-expanded':''}" style="color:${qColor}" onclick="window.kbExpand('${t.id}')">
    <div class="kb-card-text">${t.text}</div>
    <div class="kb-card-meta">
      ${t.cat ? `<span class="kb-chip" style="background:${catColor}18;color:${catColor};border:1px solid ${catColor}30">${t.cat}</span>` : ''}
      ${deferBadge}${fiBadge}
      <span class="kb-xp">+${t.xpValue || 10} XP</span>
    </div>
    <div class="kb-actions">${actionsHTML}</div>
  </div>`;
}

function renderList(tasks) {
  return QUADS.map(q => {
    const items = tasks.filter(t => t.quadrant === q.key);
    return `<div class="card ${q.cls}" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:10px;font-weight:700;color:${q.color}">${q.label}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:1px">${q.sub}</div>
        </div>
        <span class="num" style="font-size:14px;color:${q.color}">${items.filter(t=>!t.done).length}</span>
      </div>
      ${items.map(t => taskItemHTML(t, q.color)).join('')}
    </div>`;
  }).join('');
}

function renderMatrix(tasks) {
  return `<div class="quadrant-grid">
    ${QUADS.map(q => {
      const all      = tasks.filter(t => t.quadrant === q.key && !t.done);
      const видимые  = all.slice(0,4);
      return `<div class="quadrant-card" style="border-top:2px solid ${q.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:pointer"
          onclick="window.matrixOpenKanban('${q.key}')" title="Открыть в Kanban">
          <div style="font-size:9px;font-weight:700;color:${q.color}">${q.label.split('·')[0].trim()}</div>
          <span class="num" style="font-size:12px;color:${q.color}">${all.length} 🗂</span>
        </div>
        ${видимые.map(t => `
          <div style="font-size:11px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:6px;align-items:flex-start">
            <div style="width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,.2);flex-shrink:0;margin-top:2px;cursor:pointer"
                 onclick="event.stopPropagation();window.toggleTask('${t.id}')"></div>
            <span style="line-height:1.3;cursor:pointer;flex:1" onclick="window.openTaskDetail('${t.id}')">${t.text}</span>
          </div>`).join('')}
        ${видимые.length === 0 ? `<div style="font-size:10px;color:rgba(232,237,245,.25);text-align:center;padding:12px 0">✓ Пусто</div>` : ''}
        ${all.length > 4 ? `<div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:6px;text-align:center">+${all.length-4} ещё</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function taskItemHTML(t, quadColor) {
  const cc = CAT_COLOR[t.cat] || 'rgba(232,237,245,.1)';
  const quad = QUADS.find(q => q.key === t.quadrant);
  const quadEmoji = quad ? quad.label.split(' ')[0] : '';
  const дата = t.start_iso ? new Date(t.start_iso) : (t.due_date ? new Date(t.due_date) : null);
  const датаСтр = дата ? форматДата(дата, { compact: true }) : (t.time || '');
  // Бейдж финансового импакта
  const fiIcons = { direct: '💰', indirect: '💡' };
  const fiBadge = fiIcons[t.financial_impact] ? `<span style="font-size:10px" title="${t.financial_impact==='direct'?'Прямой доход':'Косвенный рост'}">${fiIcons[t.financial_impact]}</span>` : '';
  // Имя проекта
  const проект = t.project_id ? (DB.getProjects().find(p => p.id === t.project_id)) : null;
  const projBadge = проект ? `<span style="font-size:8px;background:${проект.color||'#7B61FF'}18;color:${проект.color||'#7B61FF'};border:1px solid ${проект.color||'#7B61FF'}30;border-radius:4px;padding:1px 5px">${проект.emoji||''} ${проект.name}</span>` : '';

  // Счётчик переносов [T:X] — §3.2
  const dc = t.defer_count || 0;
  const deferBadge = dc >= 1
    ? `<span style="font-size:8px;background:rgba(255,${dc>=3?'69,96':'159,67'},.15);color:${dc>=3?'#FF4560':'#FF9F43'};border:1px solid ${dc>=3?'rgba(255,69,96,.3)':'rgba(255,159,67,.3)'};border-radius:4px;padding:1px 5px;margin-left:3px;font-weight:700">T:${dc}</span>`
    : '';

  return `<div class="task-item${t.done?' done':''}${t.cancelled?' cancelled':''}">
    <div class="checkbox${t.done?' checked':''}" style="${t.done?`background:${quadColor};border-color:${quadColor};color:#000`:''}" onclick="event.stopPropagation();window.toggleTask('${t.id}')">
      ${t.done?'✓':''}
    </div>
    <div style="flex:1;cursor:pointer;min-width:0" onclick="window.openTaskDetail('${t.id}')">
      <div class="task-text" style="font-size:12px;font-weight:500">${t.text} ${fiBadge}${deferBadge}</div>
      <div class="row" style="gap:6px;margin-top:3px;font-size:9px;color:rgba(232,237,245,.4);flex-wrap:wrap">
        ${quadEmoji ? `<span>${quadEmoji}</span>` : ''}
        ${датаСтр ? `<span>· ${датаСтр}</span>` : ''}
        ${projBadge}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
      <span class="badge" style="background:${cc}18;color:${cc};border:1px solid ${cc}30">${t.cat || '—'}</span>
    </div>
  </div>`;
}

// ── ADD TASK MODAL — голос + AI-классификация + быстрые даты ────────────────
const ОСНОВНЫЕ_КАТЕГОРИИ = [
  'Работа','Контент','Эксперименты','Семья','Встречи','Быт',
  'Стратегия','Обучение','Деньги','Здоровье','Chill'
];

export function openAddTask() {
  const existing = document.getElementById('add-task-modal');
  if (existing) existing.remove();

  // Состояние модалки: 'auto' = AI решит, конкретное значение = ручной выбор
  window._addState = { cat: 'auto', quad: 'auto', time: '', recording: null };

  const div = document.createElement('div');
  div.id = 'add-task-modal';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
    <div class="modal-handle"></div>
    <div class="modal-title">+ Новая задача</div>

    <!-- ГОЛОСОВОЙ ВВОД -->
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
      <button id="add-mic" onclick="window.addMicToggle()" style="
        width:48px;height:48px;border-radius:50%;border:none;cursor:pointer;
        background:linear-gradient(135deg,#FF4560,#FF6B6B);font-size:20px;color:#fff;
        box-shadow:0 0 16px rgba(255,69,96,.35);flex-shrink:0">🎙️</button>
      <div style="flex:1;font-size:11px;color:rgba(232,237,245,.55);line-height:1.4">
        <div id="add-mic-hint">Нажми и говори — AI заполнит все поля</div>
        <div id="add-mic-timer" style="font-family:'Orbitron';font-size:13px;color:#FF4560;margin-top:2px;min-height:16px"></div>
      </div>
    </div>

    <!-- ТЕКСТ ЗАДАЧИ -->
    <textarea id="task-input" class="input" rows="2" placeholder="Что нужно сделать..." style="margin-bottom:14px;resize:vertical"></textarea>

    <!-- КНОПКА AI-РАЗБОР -->
    <button id="add-ai-btn" class="btn btn-ghost" style="width:100%;margin-bottom:14px;font-size:11px;border-color:rgba(123,97,255,.3);color:#7B61FF" onclick="window.addAiClassify()">
      🧠 Разобрать через AI (категорию, квадрант, время)
    </button>

    <!-- КАТЕГОРИЯ -->
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Категория</div>
    <div class="cat-pills" id="add-cats">
      <button class="cat-pill active" data-cat="auto" onclick="window.addPickCat('auto')" style="--cc:#FFD700">✨ Авто</button>
      ${ОСНОВНЫЕ_КАТЕГОРИИ.map(cat=>`<button class="cat-pill" data-cat="${cat}" onclick="window.addPickCat('${cat}')" style="--cc:${CAT_COLOR[cat]||'#00F5D4'}">${cat}</button>`).join('')}
    </div>

    <!-- ДАТА -->
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin:14px 0 6px">Срок</div>
    <div class="cat-pills" id="add-dates">
      <button class="cat-pill active" data-date="" onclick="window.addPickDate(this, '')" style="--cc:#FFD700">— Без даты</button>
      <button class="cat-pill" data-date="сегодня" onclick="window.addPickDate(this, 'сегодня')" style="--cc:#FF4560">📅 Сегодня</button>
      <button class="cat-pill" data-date="завтра" onclick="window.addPickDate(this, 'завтра')" style="--cc:#FF9F43">📅 Завтра</button>
      <button class="cat-pill" data-date="эта нед." onclick="window.addPickDate(this, 'эта нед.')" style="--cc:#00F5D4">📅 На неделе</button>
      <button class="cat-pill" data-date="след. нед." onclick="window.addPickDate(this, 'след. нед.')" style="--cc:#7B61FF">📅 След. нед.</button>
    </div>
    <input id="task-time-custom" class="input" placeholder="...или впиши свой срок (15 июля, пт 14:00)" style="margin-top:8px;font-size:12px">

    <!-- КВАДРАНТ -->
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin:14px 0 6px">Категория срочности</div>
    <div class="quad-picker" id="add-quads">
      <button class="quad-btn active" data-quad="auto" onclick="window.addPickQuad('auto')" style="border-color:rgba(255,215,0,.3);color:#FFD700">✨ Авто</button>
      ${QUADS.map(q=>`<button class="quad-btn" data-quad="${q.key}" onclick="window.addPickQuad('${q.key}')" style="border-color:${q.color}33;color:${q.color}">${q.label}</button>`).join('')}
    </div>

    <!-- КНОПКИ -->
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="window.closeAddTask()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitAddTask()">Добавить ✓</button>
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) window.closeAddTask(); });
  document.body.appendChild(div);

  setTimeout(() => document.getElementById('task-input')?.focus(), 100);
  TG.hapticImpact('light');
}

// ── GLOBALS (called via onclick) ──────────────────────────────────────────────
window.toggleTask = function(id) {
  const task = DB.toggleTask(id);
  if (task) { onTaskToggled(task); TG.hapticImpact('medium'); }
  renderTasks();
};

window.openTaskDetail = function(id) {
  const task = DB.getTasks().find(t => t.id === id);
  if (task) openTaskDetail(task, renderTasks);
};

window.setTaskView = function(mode) {
  viewMode = mode;
  renderTasks();
};

// §6.2 Matrix → Kanban: тап на заголовок квадранта открывает Kanban
// (в будущем можно добавить фильтрацию по квадранту)
window.matrixOpenKanban = function(quad) {
  viewMode = 'kanban';
  renderTasks();
};

// ── KANBAN handlers ────────────────────────────────────────────────────────
window.kbExpand = function(id) {
  kbExpanded = kbExpanded === id ? null : id;
  // Перерисовываем только kanban без полного сброса экрана
  if (viewMode === 'kanban') renderTasks();
};

window.kbMove = function(id, newStatus) {
  kbExpanded = null;
  DB.setKanbanStatus(id, newStatus);
  const labels = { inbox:'📥 Входящие', working:'⚡ В работе', waiting:'⏳ Ожидание' };
  window.showToast?.(`${labels[newStatus] || newStatus}`, 'info');
  renderTasks();
};

window.kbDone = function(id) {
  kbExpanded = null;
  const t = DB.getTasks().find(x => x.id === id);
  if (t && !t.done) {
    const result = DB.toggleTask(id);
    onTaskToggled(result);
  }
  renderTasks();
};


window.ideaBankRevive = function(id) {
  const idea = DB.getIdeaBank().find(x => x.id === id);
  if (!idea) return;
  DB.removeFromIdeaBank(id);
  DB.addTask({ text: idea.text, cat: idea.cat || 'Работа', quadrant: 'do', notes: idea.notes || '', _forceQ1: true });
  window.showToast?.('⚡ Идея → Q1!', 'success');
  renderTasks();
};

window.ideaBankDelete = function(id) {
  DB.removeFromIdeaBank(id);
  window.showToast?.('🗑 Удалено из банка идей', 'info');
  renderTasks();
};

window.setCatFilter = function(f) {
  catFilter = f;
  const m = document.getElementById('task-cat-menu');
  if (m) m.style.display = 'none';
  renderTasks();
};

window.toggleTaskCatMenu = function() {
  const m = document.getElementById('task-cat-menu');
  if (!m) return;
  m.style.display = m.style.display === 'none' ? 'flex' : 'none';
};

window.openAddTask = openAddTask;

window.closeAddTask = function() {
  document.getElementById('add-task-modal')?.remove();
  TG.hapticImpact('light');
};

window.addPickCat = function(cat) {
  document.querySelectorAll('#add-cats .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#add-cats [data-cat="${CSS.escape(cat)}"]`)?.classList.add('active');
  window._addState.cat = cat;
  TG.hapticSelection();
};

window.addPickQuad = function(quad) {
  document.querySelectorAll('#add-quads .quad-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`#add-quads [data-quad="${CSS.escape(quad)}"]`)?.classList.add('active');
  window._addState.quad = quad;
  TG.hapticSelection();
};

window.addPickDate = function(el, date) {
  document.querySelectorAll('#add-dates .cat-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('task-time-custom').value = '';
  window._addState.time = date;
  TG.hapticSelection();
};

// ── ГОЛОСОВОЙ ВВОД ────────────────────────────────────────────────────────────
window.addMicToggle = async function() {
  const кнопка = document.getElementById('add-mic');
  const подсказка = document.getElementById('add-mic-hint');
  const таймерЭл = document.getElementById('add-mic-timer');
  const рек = window._addState.recording;

  if (рек && рек.recorder?.state === 'recording') {
    рек.recorder.stop();
    кнопка.style.animation = 'none';
    кнопка.textContent = '🎙️';
    подсказка.textContent = '⏳ Расшифровываю и разбираю…';
    if (рек.timer) clearInterval(рек.timer);
    return;
  }

  try {
    const поток = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(поток, { mimeType });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      поток.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mimeType });
      await отправитьГолос(blob, mimeType);
    };
    recorder.start();
    let секунды = 0;
    const timer = setInterval(() => {
      секунды++;
      const m = String(Math.floor(секунды/60)).padStart(2,'0');
      const s = String(секунды%60).padStart(2,'0');
      таймерЭл.textContent = `${m}:${s}`;
    }, 1000);

    window._addState.recording = { recorder, timer };
    кнопка.textContent = '⏹';
    кнопка.style.animation = 'pulseRec 1.2s ease-in-out infinite';
    подсказка.textContent = 'Идёт запись… Нажми ⏹ когда закончишь';
  } catch (err) {
    подсказка.innerHTML = `❌ Нет доступа к микрофону`;
    console.error(err);
  }
};

async function отправитьГолос(blob, mimeType) {
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    if (!res.ok) throw new Error('Whisper не ответил');
    const { text } = await res.json();
    document.getElementById('task-input').value = text;
    document.getElementById('add-mic-hint').textContent = '✓ Текст готов. Разбираю через AI…';
    await window.addAiClassify();
  } catch (err) {
    document.getElementById('add-mic-hint').textContent = `❌ ${err.message}`;
  }
}

// ── AI РАЗБОР ────────────────────────────────────────────────────────────────
window.addAiClassify = async function() {
  const text = document.getElementById('task-input')?.value?.trim();
  if (!text) { document.getElementById('task-input')?.focus(); return; }
  const подсказка = document.getElementById('add-mic-hint');
  const кнопка = document.getElementById('add-ai-btn');
  кнопка.textContent = '🧠 Разбираю…';
  кнопка.disabled = true;
  try {
    const res = await fetch('/api/classify-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ текст: text }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || 'API ошибка');
    }
    const разбор = await res.json();
    // Применяем результат
    if (разбор.text)     document.getElementById('task-input').value = разбор.text;
    if (разбор.cat)      window.addPickCat(разбор.cat);
    if (разбор.quadrant) window.addPickQuad(разбор.quadrant);
    if (разбор.time)     {
      // Если совпало с быстрой кнопкой — выделяем её, иначе впишем в custom
      const быстрая = document.querySelector(`#add-dates [data-date="${CSS.escape(разбор.time)}"]`);
      if (быстрая) window.addPickDate(быстрая, разбор.time);
      else { document.getElementById('task-time-custom').value = разбор.time; window._addState.time = разбор.time; }
    }
    подсказка.textContent = `✓ AI разобрал: ${разбор.cat || '?'} · ${разбор.quadrant || '?'} · ${разбор.уверенность || 0}%`;
    TG.hapticSuccess();
  } catch (err) {
    подсказка.textContent = `⚠️ ${err.message}`;
    TG.hapticError();
  } finally {
    кнопка.textContent = '🧠 Разобрать через AI (категорию, квадрант, время)';
    кнопка.disabled = false;
  }
};

window.submitAddTask = async function() {
  const text = document.getElementById('task-input')?.value?.trim();
  if (!text) { document.getElementById('task-input')?.focus(); return; }

  let { cat, quad, time } = window._addState;
  // Если что-то на «Авто» и AI не запускали — запустим прямо сейчас
  if (cat === 'auto' || quad === 'auto') {
    await window.addAiClassify();
    ({ cat, quad, time } = window._addState);
  }

  // Дата: либо выбрана быстрой кнопкой, либо вписана в custom-поле
  const customTime = document.getElementById('task-time-custom')?.value?.trim();
  const финальноеВремя = customTime || time || '—';

  const finalQuad = quad === 'auto' ? 'schedule' : quad;
  DB.addTask({
    text,
    cat:        cat === 'auto' ? 'Работа' : cat,
    time:       финальноеВремя,
    quadrant:   finalQuad,
    difficulty: finalQuad === 'do' ? 3 : 2,  // Q1 → сложность 3 по умолчанию
  });
  window.closeAddTask();
  TG.hapticSuccess();
  renderTasks();
};

// Анимация для записи (если ещё не подгружена)
if (!document.getElementById('add-task-anim')) {
  const st = document.createElement('style');
  st.id = 'add-task-anim';
  st.textContent = `@keyframes pulseRec { 0%,100%{transform:scale(1);box-shadow:0 0 20px rgba(255,69,96,.5)} 50%{transform:scale(1.08);box-shadow:0 0 35px rgba(0,245,212,.6)} }`;
  document.head.appendChild(st);
}
