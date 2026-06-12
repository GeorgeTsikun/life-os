// ── КОНТЕНТ-СТУДИЯ ────────────────────────────────────────────────────────────
// Пайплайн: Идея → Сценарий → Съёмка → Монтаж → Запланировано → Опубликовано
// Группировка по платформам, метрики после публикации.

import { DB } from '../db.js?v=29';
import { TG } from '../telegram.js?v=29';

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

    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div>
        <div class="num" style="font-size:16px">КОНТЕНТ</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${весь.length} единиц · ${опубликовано.length} опубликовано</div>
      </div>
      <button class="btn btn-teal" onclick="window.openAddContent()">+ Идея</button>
    </div>

    <!-- ПЕРЕКЛЮЧАТЕЛЬ ПЛАТФОРМ -->
    <div class="cat-pills" style="margin-bottom:16px">
      ${ПЛАТФОРМЫ.map(п => `
        <button class="cat-pill ${п.id===выбраннаяПлатформа?'active':''}"
                onclick="window.выбратьПлатформу('${п.id}')"
                style="--cc:${п.color};font-size:11px;padding:6px 12px">
          ${п.emoji} ${п.name}
          <span style="margin-left:4px;opacity:.5">${весь.filter(c=>(c.platforms||[]).includes(п.id)).length}</span>
        </button>
      `).join('')}
    </div>

    ${наПлатформе.length === 0 ? `
      <div style="text-align:center;padding:40px 20px;color:rgba(232,237,245,.4)">
        <div style="font-size:48px;margin-bottom:12px">${платформа.emoji}</div>
        <div style="font-size:13px">Для ${платформа.name} пока ничего нет.</div>
        <div style="font-size:11px;margin-top:8px">Нажми «+ Идея» чтобы начать.</div>
      </div>
    ` : ''}

    <!-- ПАЙПЛАЙН ПО СТАТУСАМ -->
    ${по_статусу.filter(s => s.items.length > 0).map(с => `
      <div class="card" style="margin-bottom:12px;border-top:2px solid ${с.color}">
        <div class="row" style="justify-content:space-between;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:${с.color};letter-spacing:.05em">${с.name}</div>
          <span class="num" style="font-size:14px;color:${с.color}">${с.items.length}</span>
        </div>
        ${с.items.map(c => renderКонтентКарточку(c, с.color)).join('')}
      </div>
    `).join('')}

    ${опубликовано.length > 0 ? `
      <div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(0,227,150,.06),rgba(0,245,212,.04))">
        <div class="sec-label">📊 ЗА МЕСЯЦ (введи метрики кликом на пост)</div>
        <div class="grid3" style="margin-top:8px">
          <div style="text-align:center">
            <div class="num" style="font-size:18px;color:#00E396">${'—'}</div>
            <div style="font-size:9px;color:rgba(232,237,245,.4)">Просмотры</div>
          </div>
          <div style="text-align:center">
            <div class="num" style="font-size:18px;color:#00C9FF">${'—'}</div>
            <div style="font-size:9px;color:rgba(232,237,245,.4)">Лайки</div>
          </div>
          <div style="text-align:center">
            <div class="num" style="font-size:18px;color:#FFD700">${'—'}</div>
            <div style="font-size:9px;color:rgba(232,237,245,.4)">Подписчики</div>
          </div>
        </div>
      </div>
    ` : ''}

    <div style="height:8px"></div>
  </div>`;

  TG.hideBackButton();
  TG.hideMainButton();
}

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
