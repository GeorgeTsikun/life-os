// ── ДЕТАЛЬ ЗАДАЧИ — модалка редактирования ───────────────────────────────────
import { DB } from '../db.js?v=77';
import { TG } from '../telegram.js?v=77';
import { парсДату, форматДата, вISO, вДатуISO, вЛокальнуюФорму } from '../utils/date.js';

const CAT_LIST = [
  'Работа','Контент','Эксперименты','Семья','Встречи','Быт',
  'Стратегия','Обучение','Деньги','Здоровье','Chill'
];

const QUADS = [
  { key:'do',       label:'⚡ ШТУРМ',    color:'#FF4560' },
  { key:'schedule', label:'🏔️ РОСТ',     color:'#00F5D4' },
  { key:'delegate', label:'⚙️ РУТИНА',   color:'#7B61FF' },
  { key:'eliminate',label:'🌀 ЛОВУШКА',  color:'rgba(232,237,245,.5)' },
];

let _текущая = null;
let _онЗакрытии = null;

export function openTaskDetail(task, onClose) {
  _текущая = { ...task, subtasks: [...(task.subtasks || [])] };
  _онЗакрытии = onClose;

  const div = document.createElement('div');
  div.id = 'task-detail-modal';
  div.className = 'detail-overlay';
  div.innerHTML = разметка();
  div.addEventListener('click', e => { if (e.target === div) закрыть(); });
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('td-text')?.focus(), 50);
  TG.hapticImpact('light');
}

function разметка() {
  const t = _текущая;
  const дата = t.start_iso ? new Date(t.start_iso) : (t.due_date ? new Date(t.due_date + 'T09:00') : null);
  const датаVal = вЛокальнуюФорму(дата); // datetime-local format в ЛОКАЛЬНОМ времени

  return `<div class="detail-sheet">
    <div class="modal-handle"></div>

    <!-- Заголовок -->
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div style="font-size:14px;font-weight:700">${t.done ? '✅ ' : ''}Задача</div>
      <button onclick="window.tdЗакрыть()" style="background:none;border:none;color:rgba(232,237,245,.5);font-size:20px;cursor:pointer">×</button>
    </div>

    <!-- Текст -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Что нужно сделать</div>
    <textarea id="td-text" class="input" rows="2" style="margin-bottom:14px;resize:vertical">${escapeHtml(t.text || '')}</textarea>

    <!-- Тайм-трекинг -->
    <div id="td-timer" style="margin-bottom:14px">${таймерБлок()}</div>

    <!-- Квадрант -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Срочность</div>
    <div class="cat-pills" id="td-quads" style="margin-bottom:14px">
      ${QUADS.map(q => `
        <button class="quad-btn ${t.quadrant===q.key?'active':''}" data-quad="${q.key}"
                onclick="window.tdВыбQuad('${q.key}')"
                style="border-color:${q.color}33;color:${q.color};font-size:11px;padding:7px 10px">
          ${q.label}
        </button>
      `).join('')}
    </div>

    <!-- Категория -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Категория</div>
    <div class="cat-pills" id="td-cats" style="margin-bottom:14px">
      ${CAT_LIST.map(c => `
        <button class="cat-pill ${t.cat===c?'active':''}" data-cat="${c}" onclick="window.tdВыбCat('${c}')" style="--cc:#00F5D4">${c}</button>
      `).join('')}
    </div>

    <!-- Дата/время -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Дата и время</div>
    <div class="cat-pills" style="margin-bottom:8px">
      <button class="cat-pill" onclick="window.tdУст('today')"    style="--cc:#FFD700">⚡ Сегодня</button>
      <button class="cat-pill" onclick="window.tdУст('tomorrow')" style="--cc:#00C9FF">📅 Завтра</button>
      <button class="cat-pill" onclick="window.tdУст('next-week')" style="--cc:#7B61FF">📆 Через неделю</button>
      <button class="cat-pill" onclick="window.tdУст('clear')"    style="--cc:rgba(232,237,245,.3)">∞ Убрать</button>
    </div>
    <input id="td-date" type="datetime-local" class="input" value="${датаVal}" style="margin-bottom:14px;font-size:12px">

    <!-- §4.2 Сложность задачи (Difficulty 1-5) -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Сложность</div>
    <div class="cat-pills" id="td-difficulty" style="margin-bottom:4px">
      ${[
        {d:1, label:'🟢 1',  hint:'Мелкое', cc:'#00E396'},
        {d:2, label:'🔵 2',  hint:'Обычное', cc:'#00C9FF'},
        {d:3, label:'🟡 3',  hint:'Важное',  cc:'#FFD700'},
        {d:4, label:'🟠 4',  hint:'Сложное', cc:'#FF9F43'},
        {d:5, label:'🔴 5',  hint:'Эпик',    cc:'#FF4560'},
      ].map(x => `
        <button class="cat-pill ${(t.difficulty||2)===x.d?'active':''}" data-diff="${x.d}"
                onclick="window.tdВыбDiff(${x.d})"
                style="--cc:${x.cc}" title="${x.hint}">${x.label} · ${x.hint}</button>`).join('')}
    </div>
    <div id="td-xp-preview" style="font-size:10px;color:rgba(0,245,212,.6);margin-bottom:14px;text-align:right">
      +${DB.calcBaseXP(t.difficulty||2, t.quadrant||'schedule')} XP базово
    </div>

    <!-- Проект -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Проект</div>
    <div class="cat-pills" id="td-projects" style="margin-bottom:14px">
      <button class="cat-pill ${!t.project_id?'active':''}" data-proj=""
              onclick="window.tdВыбProj('')" style="--cc:rgba(232,237,245,.4)">— Без проекта</button>
      ${DB.getProjects().map(p => `
        <button class="cat-pill ${t.project_id===p.id?'active':''}" data-proj="${p.id}"
                onclick="window.tdВыбProj('${p.id}')"
                style="--cc:${p.color||'#7B61FF'}">${p.emoji||''} ${p.name}</button>`).join('')}
    </div>

    <!-- Финансовый импакт -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Финансовый импакт</div>
    <div class="cat-pills" id="td-finance" style="margin-bottom:14px">
      ${[
        {v:'direct',   label:'💰 Прямой',    color:'#00F5D4', hint:'приносит деньги'},
        {v:'indirect', label:'💡 Косвенный', color:'#FFD700', hint:'влияет на рост'},
        {v:'none',     label:'— Нет',        color:'rgba(232,237,245,.3)', hint:'бытовое'},
      ].map(f => `
        <button class="cat-pill ${(t.financial_impact||'none')===f.v?'active':''}" data-fi="${f.v}"
                onclick="window.tdВыбFi('${f.v}')"
                style="--cc:${f.color}" title="${f.hint}">${f.label}</button>`).join('')}
    </div>

    <!-- Заметки -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Заметки</div>
    <textarea id="td-notes" class="input" rows="2" placeholder="Дополнительные мысли, ссылки..." style="margin-bottom:14px;resize:vertical;font-size:12px">${escapeHtml(t.notes || '')}</textarea>

    <!-- Подзадачи -->
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <div style="font-size:10px;color:rgba(232,237,245,.4)">Подзадачи (${(t.subtasks||[]).filter(s=>s.done).length}/${(t.subtasks||[]).length})</div>
      <button class="btn btn-ghost" style="font-size:10px;padding:4px 8px" onclick="window.tdДобПод()">+ Добавить</button>
    </div>
    <div id="td-subtasks" style="margin-bottom:14px">
      ${renderSubtasks(t.subtasks || [])}
    </div>

    <!-- ИИ-агент: черновик задачи -->
    <button class="btn" style="width:100%;margin-bottom:10px;background:rgba(123,97,255,.12);border:1px solid rgba(123,97,255,.35);color:#A78BFA"
      onclick="window.tdЧерновик()">🤖 ИИ-черновик задачи</button>
    <div id="td-draft" style="margin-bottom:10px"></div>

    ${t.google_event_link ? `<a href="${t.google_event_link}" target="_blank" class="btn btn-ghost" style="display:block;width:100%;margin-bottom:10px;text-decoration:none;text-align:center">📅 Открыть событие в Google Calendar</a>` : ''}

    <!-- Кнопки -->
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" style="flex:1;color:rgba(232,237,245,.4);font-size:11px" onclick="window.tdОтменить()">❌ Отменить</button>
      <button class="btn btn-ghost" style="flex:1;color:#FF6B6B;font-size:11px" onclick="window.tdУдалить()">🗑 Удалить</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.tdСохранить()">💾 Сохранить</button>
    </div>
  </div>`;
}

function fmtДлит(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}ч ${m}м` : m ? `${m}м ${s}с` : `${s}с`;
}

function таймерБлок() {
  const t = _текущая;
  const активна = DB.getActiveTimer()?.taskId === t.id;
  const всего = DB.getTaskTimeSec(t.id);
  const цвет = активна ? '#00E396' : 'rgba(232,237,245,.4)';
  return `<div class="card" style="padding:12px;border:1px solid ${активна?'rgba(0,227,150,.4)':'rgba(255,255,255,.08)'}">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <span style="font-size:10px;color:rgba(232,237,245,.4);letter-spacing:.08em">⏱ ВРЕМЯ${активна?' · идёт':''}</span>
      <span class="num" style="font-size:14px;color:${цвет}">${fmtДлит(всего)}</span>
    </div>
    <div style="display:flex;gap:6px">
      ${активна
        ? `<button class="btn btn-ghost" style="flex:1" onclick="window.tdТаймер('pause')">⏸ Пауза</button>`
        : `<button class="btn btn-ghost" style="flex:1;color:#00E396" onclick="window.tdТаймер('start')">▶ Старт</button>`}
      <button class="btn btn-teal" style="flex:1" onclick="window.tdТаймер('done')">✓ Готово</button>
    </div>
  </div>`;
}

function renderSubtasks(subtasks) {
  if (!subtasks.length) return '<div style="font-size:11px;color:rgba(232,237,245,.3);text-align:center;padding:8px 0">Подзадач нет</div>';
  return subtasks.map((s, i) => `
    <div class="row" style="gap:8px;padding:5px 0;align-items:center">
      <div class="checkbox${s.done?' checked':''}" style="${s.done?'background:#00F5D4;border-color:#00F5D4;color:#000':''};cursor:pointer;font-size:9px;width:16px;height:16px"
           onclick="window.tdТогглеПод(${i})">${s.done?'✓':''}</div>
      <input type="text" class="input" value="${escapeHtml(s.text || '')}" style="flex:1;font-size:12px;padding:6px 8px;${s.done?'text-decoration:line-through;opacity:.6':''}"
             onchange="window.tdИзмПод(${i}, this.value)">
      <button onclick="window.tdУдалПод(${i})" style="background:none;border:none;color:rgba(232,237,245,.4);cursor:pointer;font-size:14px">×</button>
    </div>
  `).join('');
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function закрыть() {
  document.getElementById('task-detail-modal')?.remove();
  TG.hapticImpact('light');
}

function перерисоватьПодзадачи() {
  const эл = document.getElementById('td-subtasks');
  if (эл) эл.innerHTML = renderSubtasks(_текущая.subtasks);
}

// ── ГЛОБАЛЬНЫЕ ХЕНДЛЕРЫ ──────────────────────────────────────────────────────
window.tdТаймер = function(action) {
  const id = _текущая.id;
  if (action === 'start') DB.startTimer(id);
  else if (action === 'pause') DB.pauseTimer();
  else if (action === 'done') {
    DB.stopComplete(id);
    TG.hapticImpact('medium');
    закрыть();
    return;
  }
  const эл = document.getElementById('td-timer');
  if (эл) эл.innerHTML = таймерБлок();
  TG.hapticImpact('light');
};

// ── ИИ-АГЕНТ: ЧЕРНОВИК ЗАДАЧИ ─────────────────────────────────────────────────
window._tdDraft = null;
window.tdЧерновик = async function() {
  const box = document.getElementById('td-draft');
  if (!box) return;
  const t = _текущая;
  box.innerHTML = `<div class="card" style="padding:12px;text-align:center;color:#A78BFA;font-size:12px">
    <div style="width:22px;height:22px;border-radius:50%;border:3px solid #A78BFA;border-top-color:transparent;animation:spin .8s linear infinite;margin:0 auto 8px"></div>
    ИИ делает черновик…</div>`;
  try {
    const proj = t.project_id ? (DB.getProjects().find(p => p.id === t.project_id)?.name || '') : '';
    const r = await fetch('/api/task-draft', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t.text, cat: t.cat, notes: t.notes, project: proj }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    window._tdDraft = d;
    отрисоватьЧерновик(d);
  } catch (e) {
    box.innerHTML = `<div class="card" style="padding:12px;color:#FF5C8A;font-size:12px">⚠️ ${e.message}</div>`;
  }
};

function отрисоватьЧерновик(d) {
  const box = document.getElementById('td-draft');
  if (!box) return;
  const esc = (s) => escapeHtml(s || '');
  box.innerHTML = `<div class="card" style="padding:12px;border:1px solid rgba(123,97,255,.3)">
    ${d.draft ? `<div style="font-size:10px;color:#A78BFA;margin-bottom:4px">ЧЕРНОВИК</div>
      <div style="font-size:12px;color:#E8EDF5;white-space:pre-wrap;background:rgba(255,255,255,.03);border-radius:8px;padding:10px;margin-bottom:8px;max-height:240px;overflow:auto">${esc(d.draft)}</div>
      <button class="btn btn-ghost" style="width:100%;font-size:11px;margin-bottom:10px" onclick="window.tdЧерновикВЗаметки()">📋 Вставить в заметки</button>` : ''}
    ${d.steps?.length ? `<div style="font-size:10px;color:#A78BFA;margin-bottom:4px">ШАГИ</div>
      <ul style="margin:0 0 8px;padding-left:18px;font-size:12px;color:rgba(232,237,245,.8)">${d.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>
      <button class="btn btn-ghost" style="width:100%;font-size:11px;margin-bottom:10px" onclick="window.tdШагиВПодзадачи()">➕ Шаги в подзадачи</button>` : ''}
    ${d.questions?.length ? `<div style="font-size:10px;color:#FFD700;margin-bottom:4px">❓ УТОЧНИ</div>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#FFD58A">${d.questions.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

window.tdЧерновикВЗаметки = function() {
  const ta = document.getElementById('td-notes');
  if (ta && window._tdDraft?.draft) {
    ta.value = (ta.value ? ta.value + '\n\n' : '') + window._tdDraft.draft;
    TG.hapticSuccess();
    window.showToast?.('📋 Черновик в заметках — не забудь Сохранить', 'success');
  }
};

window.tdШагиВПодзадачи = function() {
  const steps = window._tdDraft?.steps || [];
  if (!steps.length) return;
  _текущая.subtasks = [...(_текущая.subtasks || []), ...steps.map(s => ({ text: s, done: false }))];
  перерисоватьПодзадачи();
  TG.hapticSuccess();
  window.showToast?.(`➕ Добавлено шагов: ${steps.length} — Сохрани задачу`, 'success');
};

window.tdЗакрыть = закрыть;

window.tdВыбQuad = function(q) {
  _текущая.quadrant = q;
  document.querySelectorAll('#td-quads .quad-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-quads [data-quad="${q}"]`)?.classList.add('active');
  TG.hapticSelection();
};

window.tdВыбCat = function(c) {
  _текущая.cat = c;
  document.querySelectorAll('#td-cats .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-cats [data-cat="${CSS.escape(c)}"]`)?.classList.add('active');
  TG.hapticSelection();
};

window.tdУст = function(когда) {
  const сейчас = new Date();
  let d = null;
  if (когда === 'today')      d = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate(), 9, 0);
  else if (когда === 'tomorrow') { d = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate()+1, 9, 0); }
  else if (когда === 'next-week') { d = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate()+7, 9, 0); }
  document.getElementById('td-date').value = вЛокальнуюФорму(d);
  TG.hapticSelection();
};

window.tdВыбProj = function(projId) {
  _текущая.project_id = projId || null;
  document.querySelectorAll('#td-projects .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-projects [data-proj="${projId}"]`)?.classList.add('active');
  TG.hapticSelection();
};

window.tdВыбFi = function(fi) {
  _текущая.financial_impact = fi;
  document.querySelectorAll('#td-finance .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-finance [data-fi="${fi}"]`)?.classList.add('active');
  TG.hapticSelection();
};

window.tdВыбDiff = function(d) {
  _текущая.difficulty = d;
  _текущая.xpValue = DB.calcBaseXP(d, _текущая.quadrant || 'schedule');
  document.querySelectorAll('#td-difficulty .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-difficulty [data-diff="${d}"]`)?.classList.add('active');
  const preview = document.getElementById('td-xp-preview');
  if (preview) preview.textContent = `+${_текущая.xpValue} XP базово`;
  TG.hapticSelection();
};

window.tdДобПод = function() {
  if (!_текущая.subtasks) _текущая.subtasks = [];
  _текущая.subtasks.push({ text: '', done: false });
  перерисоватьПодзадачи();
};

window.tdТогглеПод = function(i) {
  if (_текущая.subtasks[i]) {
    _текущая.subtasks[i].done = !_текущая.subtasks[i].done;
    перерисоватьПодзадачи();
    TG.hapticImpact('medium');
  }
};

window.tdИзмПод = function(i, val) {
  if (_текущая.subtasks[i]) _текущая.subtasks[i].text = val;
};

window.tdУдалПод = function(i) {
  _текущая.subtasks.splice(i, 1);
  перерисоватьПодзадачи();
  TG.hapticImpact('light');
};

window.tdСохранить = async function() {
  const текст = document.getElementById('td-text')?.value?.trim();
  if (!текст) { document.getElementById('td-text')?.focus(); return; }
  const заметки = document.getElementById('td-notes')?.value?.trim() || '';
  const датаStr = document.getElementById('td-date')?.value || '';

  const patch = {
    text: текст,
    quadrant: _текущая.quadrant,
    cat: _текущая.cat || 'Работа',
    difficulty: _текущая.difficulty || 2,
    xpValue:    DB.calcBaseXP(_текущая.difficulty || 2, _текущая.quadrant || 'schedule'),
    notes: заметки,
    subtasks: (_текущая.subtasks || []).filter(s => s.text?.trim()),
    project_id:       _текущая.project_id       || null,
    financial_impact: _текущая.financial_impact || 'none',
  };

  if (датаStr) {
    const d = new Date(датаStr);
    patch.start_iso = вISO(d);
    patch.due_date  = вДатуISO(d);
    patch.time      = форматДата(d, { compact: true });
  } else {
    patch.start_iso = null;
    patch.due_date  = null;
  }

  const обновлено = DB.updateTask(_текущая.id, patch);
  закрыть();
  _онЗакрытии?.();
  TG.hapticSuccess();
  // Показываем toast — чтобы пользователь видел что реально сохранилось
  if (window.showToast) {
    const что = [];
    if (patch.cat) что.push(patch.cat);
    if (patch.start_iso) что.push(форматДата(new Date(patch.start_iso), {compact:true}));
    window.showToast(`✓ Сохранено${что.length ? ' · ' + что.join(' · ') : ''}`, 'success');
  }
};

window.tdОтменить = function() {
  if (!confirm('Отменить задачу? Она останется в истории.')) return;
  DB.cancelTask(_текущая.id);
  закрыть();
  _онЗакрытии?.();
  TG.hapticImpact('medium');
  window.showToast?.('❌ Задача отменена (сохранена в истории)', 'info');
};

window.tdУдалить = function() {
  if (!confirm('Удалить задачу навсегда? Её нельзя будет вернуть.')) return;
  DB.deleteTask(_текущая.id);
  закрыть();
  _онЗакрытии?.();
  TG.hapticImpact('medium');
};
