// ── КОНТЕНТ-СТУДИЯ ────────────────────────────────────────────────────────────
// Пайплайн: Идея → Сценарий → Съёмка → Монтаж → Запланировано → Опубликовано
// Группировка по платформам, метрики после публикации.

import { DB } from '../db.js?v=49';
import { TG } from '../telegram.js?v=49';

const ПЛАТФОРМЫ = [
  { id:'instagram', name:'Instagram', emoji:'📷', color:'#E1306C' },
  { id:'threads',   name:'Threads',   emoji:'🧵', color:'#000000' },
  { id:'youtube',   name:'YouTube',   emoji:'▶️', color:'#FF0000' },
  { id:'telegram',  name:'Telegram',  emoji:'✈️', color:'#229ED9' },
  { id:'tiktok',    name:'TikTok',    emoji:'🎵', color:'#FE2C55' },
  { id:'dzen',      name:'Дзен',      emoji:'📰', color:'#FF6700' },
];

const СТАТУСЫ = [
  { id:'idea',      name:'💡 Идея',         color:'#FFD700' },
  { id:'script',    name:'✍️ Сценарий',     color:'#7B61FF' },
  { id:'shooting',  name:'📸 Съёмка',       color:'#FF9F43' },
  { id:'editing',   name:'🎬 Монтаж',       color:'#00C9FF' },
  { id:'scheduled', name:'📅 Запланировано',color:'#00F5D4' },
  { id:'published', name:'🚀 Опубликовано', color:'#00E396' },
];

const ТИПЫ_КОНТЕНТА = {
  instagram: ['reel','carousel','story','post'],
  threads:   ['post','thread'],
  youtube:   ['short','longvideo','live'],
  telegram:  ['post','thread','videomsg'],
  tiktok:    ['video','live'],
  dzen:      ['article','video'],
};

const ИМЕНА_ТИПОВ = {
  reel:'Рилс', carousel:'Карусель', story:'Сторис', post:'Пост',
  short:'Шортс', longvideo:'Видео', live:'Эфир', videomsg:'Видеосообщ.',
  thread:'Тред', video:'Видео', article:'Статья',
};

let выбраннаяПлатформа = 'instagram';
let contentViewMode = 'kanban'; // 'kanban' | 'list'

// Kanban колонки (упрощённые 4 стадии)
const KANBAN_COLS = [
  { id: 'idea',      label: '💡 Идея',       color: '#FFD700', statuses: ['idea'] },
  { id: 'wip',       label: '✍️ В работе',   color: '#7B61FF', statuses: ['script','shooting','editing'] },
  { id: 'scheduled', label: '📅 Запланировано', color: '#00F5D4', statuses: ['scheduled'] },
  { id: 'done',      label: '🚀 Готово',     color: '#00E396', statuses: ['published'] },
];

// ── SEED данные если нет в localStorage ───────────────────────────────────────
const SEED_CONTENT = [
  { id:'c1', title:'Разбор провального запуска Smart Stylist',
    platforms:['instagram'], content_type:'reel', status:'idea',
    refs:[], notes:'Что пошло не так и что я понял', created_at:Date.now()-86400000*2 },
  { id:'c2', title:'5 ошибок при найме команды AI-стартапа',
    platforms:['instagram','threads'], content_type:'carousel', status:'script',
    text:'Сценарий: Слайд 1 — Найм без цели...', created_at:Date.now()-86400000 },
  { id:'c3', title:'Утренний ритуал предпринимателя',
    platforms:['instagram'], content_type:'reel', status:'editing',
    created_at:Date.now()-86400000*3 },
  { id:'c4', title:'Матрица Эйзенхауэра для одиночки',
    platforms:['instagram','threads'], content_type:'carousel', status:'published',
    publish_date:'2026-06-05', created_at:Date.now()-86400000*5 },
];

function загрузитьКонтент() {
  let данные = JSON.parse(localStorage.getItem('lifeos_content') || 'null');
  if (!данные) { данные = SEED_CONTENT; localStorage.setItem('lifeos_content', JSON.stringify(данные)); }
  return данные;
}

function сохранитьКонтент(данные) {
  localStorage.setItem('lifeos_content', JSON.stringify(данные));
  window._дбHook?.('content', данные);
}

// ── РЕНДЕР ─────────────────────────────────────────────────────────────────────
export function renderContent() {
  const весь = загрузитьКонтент();
  const платформа = ПЛАТФОРМЫ.find(п => п.id === выбраннаяПлатформа);
  const наПлатформе = весь.filter(c => (c.platforms || []).includes(выбраннаяПлатформа));
  const по_статусу = СТАТУСЫ.map(s => ({
    ...s, items: наПлатформе.filter(c => (c.status || 'idea') === s.id)
  }));

  const опубликовано = наПлатформе.filter(c => c.status === 'published');
  const запланировано = наПлатформе.filter(c => c.status === 'scheduled');

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">

    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div>
        <div class="num" style="font-size:16px">КОНТЕНТ</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${весь.length} единиц · ${опубликовано.length} опубликовано</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button onclick="window.toggleContentView()" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(232,237,245,.7);font-size:11px;cursor:pointer">
          ${contentViewMode==='kanban'?'☰ Список':'⊞ Канбан'}
        </button>
        <button class="btn btn-teal" onclick="window.openAddContent()">+ Идея</button>
      </div>
    </div>

    <!-- ПЕРЕКЛЮЧАТЕЛЬ ПЛАТФОРМ -->
    <div style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px;padding-bottom:2px">
      ${ПЛАТФОРМЫ.map(п => `
        <button onclick="window.выбратьПлатформу('${п.id}')"
          style="flex-shrink:0;padding:5px 12px;border-radius:20px;font-size:11px;cursor:pointer;
                 border:1px solid ${п.id===выбраннаяПлатформа?п.color+'80':'rgba(255,255,255,.1)'};
                 background:${п.id===выбраннаяПлатформа?п.color+'18':'rgba(255,255,255,.03)'};
                 color:${п.id===выбраннаяПлатформа?п.color:'rgba(232,237,245,.5)'}">
          ${п.emoji} ${п.name} <span style="opacity:.5">${весь.filter(c=>(c.platforms||[]).includes(п.id)).length}</span>
        </button>
      `).join('')}
    </div>

    ${наПлатформе.length === 0 ? `
      <div style="text-align:center;padding:40px 20px;color:rgba(232,237,245,.4)">
        <div style="font-size:48px;margin-bottom:12px">${платформа.emoji}</div>
        <div style="font-size:13px">Для ${платформа.name} пока ничего нет.</div>
        <div style="font-size:11px;margin-top:8px">Нажми «+ Идея» чтобы начать.</div>
      </div>
    ` : contentViewMode === 'kanban' ? renderContentKanban(наПлатформе) : renderContentList(по_статусу)}


    <div style="height:8px"></div>
  </div>`;

  TG.hideBackButton();
  TG.hideMainButton();
}

// ── KANBAN VIEW ───────────────────────────────────────────────────────────────
function renderContentKanban(items) {
  return `<div style="display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:8px;align-items:flex-start">
    ${KANBAN_COLS.map(col => {
      const colItems = items.filter(c => col.statuses.includes(c.status || 'idea'));
      return `<div style="flex-shrink:0;width:200px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:0 2px">
          <div style="font-size:11px;font-weight:700;color:${col.color}">${col.label}</div>
          <div style="font-size:10px;color:rgba(232,237,245,.35);margin-left:auto">${colItems.length}</div>
        </div>
        <div style="min-height:60px">
          ${colItems.length === 0
            ? `<div style="border:1px dashed rgba(255,255,255,.08);border-radius:10px;padding:16px;text-align:center;font-size:10px;color:rgba(232,237,245,.25)">пусто</div>`
            : colItems.map(c => renderKanbanCard(c, col.color)).join('')
          }
        </div>
        ${col.id === 'idea' ? `<button onclick="window.openAddContent()" style="width:100%;margin-top:6px;padding:8px;border-radius:9px;border:1px dashed rgba(255,215,0,.2);background:transparent;color:rgba(255,215,0,.4);font-size:11px;cursor:pointer">+ Идея</button>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderKanbanCard(c, цвет) {
  const платформы = (c.platforms || []).map(id => ПЛАТФОРМЫ.find(p => p.id===id)?.emoji).filter(Boolean).join('');
  return `<div onclick="window.openContentDetail('${c.id}')"
    style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-left:2px solid ${цвет};
           border-radius:9px;padding:10px;margin-bottom:6px;cursor:pointer">
    <div style="font-size:11px;font-weight:500;line-height:1.3;margin-bottom:6px">${c.title}</div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px">${платформы}</span>
      <div style="display:flex;gap:4px">
        ${KANBAN_COLS.map(col => `
          <button onclick="event.stopPropagation();window.moveContentKanban('${c.id}','${col.statuses[0]}')"
            title="${col.label}"
            style="width:18px;height:18px;border-radius:4px;border:1px solid ${col.color}40;
                   background:${col.statuses.includes(c.status||'idea')?col.color+'30':'transparent'};
                   font-size:8px;cursor:pointer;color:${col.color}">
            ${col.statuses.includes(c.status||'idea')?'●':'○'}
          </button>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── LIST VIEW ─────────────────────────────────────────────────────────────────
function renderContentList(по_статусу) {
  const filtered = по_статусу.filter(s => s.items.length > 0);
  if (!filtered.length) return '';
  return filtered.map(с => `
    <div class="card" style="margin-bottom:12px;border-top:2px solid ${с.color}">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div style="font-size:11px;font-weight:700;color:${с.color}">${с.name}</div>
        <span class="num" style="font-size:14px;color:${с.color}">${с.items.length}</span>
      </div>
      ${с.items.map(c => renderКонтентКарточку(c, с.color)).join('')}
    </div>
  `).join('');
}

window.toggleContentView = function() {
  contentViewMode = contentViewMode === 'kanban' ? 'list' : 'kanban';
  renderContent();
};

window.moveContentKanban = function(id, newStatus) {
  const данные = загрузитьКонтент();
  const c = данные.find(x => x.id === id);
  if (c) {
    c.status = newStatus;
    if (newStatus === 'published' && !c.publish_date) c.publish_date = new Date().toISOString().split('T')[0];
    сохранитьКонтент(данные);
  }
  renderContent();
  TG.hapticImpact('light');
};

function renderКонтентКарточку(c, цвет) {
  const платформы = (c.platforms || []).map(id => ПЛАТФОРМЫ.find(p => p.id===id)?.emoji).filter(Boolean).join(' ');
  const тип = ИМЕНА_ТИПОВ[c.content_type] || c.content_type || '';
  return `<div onclick="window.openContentDetail('${c.id}')" style="padding:10px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:7px;cursor:pointer">
    <div style="font-size:12px;font-weight:500;margin-bottom:4px">${c.title}</div>
    <div class="row" style="gap:6px;font-size:10px;color:rgba(232,237,245,.5)">
      <span>${платформы}</span>
      ${тип ? `<span>· ${тип}</span>` : ''}
      ${c.publish_date ? `<span>· ${c.publish_date}</span>` : ''}
    </div>
  </div>`;
}

// ── ВЫБОР ПЛАТФОРМЫ ───────────────────────────────────────────────────────────
window.выбратьПлатформу = function(id) {
  выбраннаяПлатформа = id;
  renderContent();
  TG.hapticSelection();
};

// ── ДОБАВЛЕНИЕ ИДЕИ ───────────────────────────────────────────────────────────
window.openAddContent = function() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
    <div class="modal-handle"></div>
    <div class="modal-title">+ Идея для контента</div>

    <input id="content-title" class="input" placeholder="Заголовок идеи..." style="margin-bottom:10px" autofocus>
    <textarea id="content-text" class="input" rows="3" placeholder="Сценарий / тезисы / описание (опц.)" style="margin-bottom:14px;resize:vertical"></textarea>

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Платформы (выбери одну или несколько)</div>
    <div class="cat-pills" style="margin-bottom:14px" id="add-content-platforms">
      ${ПЛАТФОРМЫ.map(p => `
        <button class="cat-pill" data-platform="${p.id}" onclick="window.tgПлатформу(this,'${p.id}')" style="--cc:${p.color}">${p.emoji} ${p.name}</button>
      `).join('')}
    </div>

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Тип</div>
    <div class="cat-pills" style="margin-bottom:14px" id="add-content-types">
      ${[...new Set(Object.values(ТИПЫ_КОНТЕНТА).flat())].map(t =>
        `<button class="cat-pill" data-type="${t}" onclick="window.выбратьТипКонтента(this,'${t}')">${ИМЕНА_ТИПОВ[t]||t}</button>`
      ).join('')}
    </div>

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Ссылки на референсы (по одной с новой строки)</div>
    <textarea id="content-refs" class="input" rows="2" placeholder="https://..." style="margin-bottom:14px;resize:vertical;font-size:11px"></textarea>

    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitContent()">Сохранить ✓</button>
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);

  window._contentPlatforms = [выбраннаяПлатформа]; // авто-выбор текущей
  setTimeout(() => {
    document.querySelector(`[data-platform="${выбраннаяПлатформа}"]`)?.classList.add('active');
    document.getElementById('content-title')?.focus();
  }, 100);
  TG.hapticImpact('light');
};

window.tgПлатформу = function(el, id) {
  el.classList.toggle('active');
  if (!window._contentPlatforms) window._contentPlatforms = [];
  if (el.classList.contains('active')) {
    if (!window._contentPlatforms.includes(id)) window._contentPlatforms.push(id);
  } else {
    window._contentPlatforms = window._contentPlatforms.filter(x => x !== id);
  }
  TG.hapticSelection();
};

window.выбратьТипКонтента = function(el, type) {
  document.querySelectorAll('#add-content-types .cat-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  window._contentType = type;
  TG.hapticSelection();
};

window.submitContent = function() {
  const title = document.getElementById('content-title')?.value?.trim();
  if (!title) { document.getElementById('content-title')?.focus(); return; }
  const text  = document.getElementById('content-text')?.value?.trim() || '';
  const refs  = (document.getElementById('content-refs')?.value || '')
                  .split('\n').map(s => s.trim()).filter(Boolean);
  const платформы = window._contentPlatforms?.length ? window._contentPlatforms : [выбраннаяПлатформа];

  const все = загрузитьКонтент();
  все.unshift({
    id:        'c' + Date.now(),
    title, text, refs,
    platforms: платформы,
    content_type: window._contentType || null,
    status:    'idea',
    created_at: Date.now(),
  });
  сохранитьКонтент(все);
  document.querySelector('.modal-overlay')?.remove();
  TG.hapticSuccess();
  renderContent();
};

// ── ДЕТАЛЬ КАРТОЧКИ ───────────────────────────────────────────────────────────
window.openContentDetail = function(id) {
  const все = загрузитьКонтент();
  const c = все.find(x => x.id === id);
  if (!c) return;

  const div = document.createElement('div');
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div style="font-size:16px;font-weight:700;margin-bottom:8px">${c.title}</div>
    <div class="row" style="gap:6px;margin-bottom:14px;font-size:11px;color:rgba(232,237,245,.5)">
      ${(c.platforms||[]).map(id => ПЛАТФОРМЫ.find(p=>p.id===id)?.emoji).filter(Boolean).join(' ')}
      ${c.content_type ? `· ${ИМЕНА_ТИПОВ[c.content_type]||c.content_type}` : ''}
    </div>

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Статус</div>
    <div class="cat-pills" style="margin-bottom:14px" id="status-picker">
      ${СТАТУСЫ.map(s => `
        <button class="cat-pill ${c.status===s.id?'active':''}" data-status="${s.id}"
                onclick="window.changeContentStatus('${c.id}','${s.id}')"
                style="--cc:${s.color}">${s.name}</button>
      `).join('')}
    </div>

    ${c.text ? `
      <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Сценарий / текст</div>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px;font-size:12px;line-height:1.5;margin-bottom:14px;white-space:pre-wrap">${c.text}</div>
    ` : ''}

    ${(c.refs && c.refs.length) ? `
      <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">Референсы</div>
      <div style="margin-bottom:14px">
        ${c.refs.map(url => `<a href="${url}" target="_blank" style="display:block;font-size:11px;color:#00F5D4;margin-bottom:4px;text-decoration:none;word-break:break-all">→ ${url}</a>`).join('')}
      </div>
    ` : ''}

    ${c.status === 'published' ? `
      <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:6px">📊 Метрики (введи цифры)</div>
      <div class="grid3" style="margin-bottom:14px">
        <input class="input" type="number" placeholder="Просмотры" style="font-size:12px">
        <input class="input" type="number" placeholder="Лайки" style="font-size:12px">
        <input class="input" type="number" placeholder="Подписки" style="font-size:12px">
      </div>
    ` : ''}

    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.detail-overlay').remove()">Закрыть</button>
      <button class="btn btn-ghost" style="color:#FF6B6B" onclick="window.deleteContent('${c.id}')">🗑 Удалить</button>
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  TG.hapticImpact('light');
};

window.changeContentStatus = function(id, status) {
  const все = загрузитьКонтент();
  const c = все.find(x => x.id === id);
  if (c) {
    c.status = status;
    if (status === 'published' && !c.publish_date) c.publish_date = new Date().toISOString().split('T')[0];
    сохранитьКонтент(все);
  }
  document.querySelector('.detail-overlay')?.remove();
  renderContent();
  TG.hapticSuccess();
};

window.deleteContent = function(id) {
  if (!confirm('Удалить эту единицу контента?')) return;
  const все = загрузитьКонтент().filter(x => x.id !== id);
  сохранитьКонтент(все);
  document.querySelector('.detail-overlay')?.remove();
  renderContent();
  TG.hapticImpact('medium');
};
