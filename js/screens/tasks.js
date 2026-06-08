// ── TASKS SCREEN ──────────────────────────────────────────────────────────────
import { DB } from '../db.js';
import { onTaskToggled } from '../gamification.js';
import { TG } from '../telegram.js';

const CAT_COLOR = {
  'Бизнес':'#00F5D4','Деньги':'#FFD700','Клуб':'#7B61FF','Стратегия':'#00E396',
  'Здоровье':'#FF6B6B','Контент':'#FF9F43','Юрид.':'#C8D6E5','Ловушка':'rgba(232,237,245,.3)',
  'Семья':'#FF9F43','Личное':'#00C9FF',
};

const QUADS = [
  { key:'do',       label:'🔴 ВАЖНО · СРОЧНО',     sub:'Делай сейчас',  color:'#FF4560', cls:'accent-red'    },
  { key:'schedule', label:'🟢 ВАЖНО · НЕ СРОЧНО',  sub:'Запланируй',    color:'#00F5D4', cls:'accent-teal'   },
  { key:'delegate', label:'🟡 НЕ ВАЖНО · СРОЧНО',  sub:'Делегируй',     color:'#7B61FF', cls:'accent-violet' },
  { key:'eliminate',label:'⚫ НЕ ВАЖНО · НЕ СРОЧНО',sub:'Удали',        color:'rgba(232,237,245,.35)',cls:'accent-gray'},
];

let viewMode = 'list'; // 'list' | 'matrix'

export function renderTasks() {
  const tasks = DB.getTasks();
  const total = tasks.length;
  const done  = tasks.filter(t=>t.done).length;

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:12px">
    <div>
      <div class="num" style="font-size:16px">ЗАДАЧИ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${done} / ${total} выполнено · XP: ${done * 50}</div>
    </div>
    <button class="btn btn-teal" onclick="window.openAddTask()">+ Добавить</button>
  </div>

  <div class="toggle-row" style="margin-bottom:14px">
    <button class="toggle-btn${viewMode==='list'?' active':''}" onclick="window.setTaskView('list')">📋 Список</button>
    <button class="toggle-btn${viewMode==='matrix'?' active':''}" onclick="window.setTaskView('matrix')">🔲 Матрица</button>
  </div>

  ${viewMode === 'matrix' ? renderMatrix(tasks) : renderList(tasks)}

  <div style="height:8px"></div>
</div>`;

  TG.hideMainButton();
  TG.hideBackButton();
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
      const items = tasks.filter(t => t.quadrant === q.key && !t.done).slice(0,3);
      return `<div class="quadrant-card" style="border-top:2px solid ${q.color}">
        <div style="font-size:9px;font-weight:700;color:${q.color};margin-bottom:8px">${q.label.split('·')[0].trim()}</div>
        ${items.map(t => `<div style="font-size:11px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;display:flex;gap:6px;align-items:center" onclick="window.toggleTask('${t.id}')">
          <div style="width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,.2);flex-shrink:0;font-size:9px;display:flex;align-items:center;justify-content:center"></div>
          <span>${t.text}</span>
        </div>`).join('')}
        ${items.length === 0 ? `<div style="font-size:10px;color:rgba(232,237,245,.25);text-align:center;padding:8px 0">✓ Пусто</div>` : ''}
        ${tasks.filter(t=>t.quadrant===q.key&&!t.done).length > 3 ? `<div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:6px">+${tasks.filter(t=>t.quadrant===q.key&&!t.done).length-3} ещё</div>` : ''}
      </div>`;
    }).join('')}
  </div>
  ${QUADS.map(q => {
    const items = tasks.filter(t => t.quadrant === q.key);
    return renderList(tasks.filter(t=>t.quadrant===q.key));
  }).join('')}`;
}

function taskItemHTML(t, quadColor) {
  const cc = CAT_COLOR[t.cat] || 'rgba(232,237,245,.1)';
  return `<div class="task-item${t.done?' done':''}" onclick="window.toggleTask('${t.id}')">
    <div class="checkbox${t.done?' checked':''}" style="${t.done?`background:${quadColor};border-color:${quadColor};color:#000`:''}">
      ${t.done?'✓':''}
    </div>
    <div style="flex:1">
      <div class="task-text" style="font-size:12px;font-weight:500">${t.text}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      <span class="badge" style="background:${cc}18;color:${cc};border:1px solid ${cc}30">${t.cat}</span>
      <span style="font-size:9px;color:rgba(232,237,245,.35)">${t.time || ''}</span>
    </div>
  </div>`;
}

// ── ADD TASK MODAL ────────────────────────────────────────────────────────────
export function openAddTask() {
  const existing = document.getElementById('add-task-modal');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'add-task-modal';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">+ Новая задача</div>
    <input id="task-input" class="input" placeholder="Что нужно сделать..." style="margin-bottom:12px" autofocus>
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:8px">Категория</div>
    <div class="cat-pills">
      ${Object.entries(CAT_COLOR).map(([cat,c])=>`<button class="cat-pill" data-cat="${cat}" onclick="window.selectCat(this,'${cat}')" style="--cc:${c}">${cat}</button>`).join('')}
    </div>
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:8px">Срок (опц.)</div>
    <input id="task-time" class="input" placeholder="напр. сегодня, пт, июль..." style="margin-bottom:16px">
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:8px">Квадрант</div>
    <div class="quad-picker">
      ${QUADS.map(q=>`<button class="quad-btn" data-quad="${q.key}" onclick="window.selectQuad(this,'${q.key}')" style="border-color:${q.color}22;color:${q.color}">${q.label}</button>`).join('')}
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="window.closeAddTask()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitAddTask()">Добавить ✓</button>
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) window.closeAddTask(); });
  document.body.appendChild(div);

  window._selectedCat  = 'Бизнес';
  window._selectedQuad = 'do';

  // Pre-select defaults
  setTimeout(() => {
    document.querySelector('[data-cat="Бизнес"]')?.classList.add('active');
    document.querySelector('[data-quad="do"]')?.classList.add('active');
    document.getElementById('task-input')?.focus();
  }, 50);

  TG.hapticImpact('light');
}

// ── GLOBALS (called via onclick) ──────────────────────────────────────────────
window.toggleTask = function(id) {
  const task = DB.toggleTask(id);
  if (task) { onTaskToggled(task); TG.hapticImpact('medium'); }
  renderTasks();
};

window.setTaskView = function(mode) {
  viewMode = mode;
  renderTasks();
};

window.openAddTask = openAddTask;

window.closeAddTask = function() {
  document.getElementById('add-task-modal')?.remove();
  TG.hapticImpact('light');
};

window.selectCat = function(el, cat) {
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  window._selectedCat = cat;
  TG.hapticSelection();
};

window.selectQuad = function(el, quad) {
  document.querySelectorAll('.quad-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active', `active-${quad}`);
  window._selectedQuad = quad;
  TG.hapticSelection();
};

window.submitAddTask = function() {
  const text = document.getElementById('task-input')?.value?.trim();
  if (!text) { document.getElementById('task-input')?.focus(); return; }
  const time = document.getElementById('task-time')?.value?.trim() || '—';
  DB.addTask({ text, cat: window._selectedCat || 'Бизнес', time, quadrant: window._selectedQuad || 'do' });
  window.closeAddTask();
  TG.hapticSuccess();
  renderTasks();
};
