// ── ДЕТАЛЬ ЗАДАЧИ — модалка редактирования ───────────────────────────────────
import { DB } from '../db.js';
import { TG } from '../telegram.js';
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

    <!-- Ценность задачи (баллы) -->
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Ценность задачи</div>
    <div class="cat-pills" id="td-points" style="margin-bottom:14px">
      ${[5,10,15,20,25,50].map(pts => `
        <button class="cat-pill ${(t.xpValue||10)===pts?'active':''}" data-pts="${pts}"
                onclick="window.tdВыбPts(${pts})"
                style="--cc:${pts>=25?'#FFD700':pts>=15?'#00F5D4':'rgba(232,237,245,.5)'}">
          ${pts} ${pts===5?'· мелкое':pts===10?'· полезное':pts===15?'· важное':pts===20?'· дорогое':pts===25?'· крутое':'· огромное'}
        </button>`).join('')}
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

    ${t.google_event_link ? `<a href="${t.google_event_link}" target="_blank" class="btn btn-ghost" style="display:block;width:100%;margin-bottom:10px;text-decoration:none;text-align:center">📅 Открыть событие в Google Calendar</a>` : ''}

    <!-- Кнопки -->
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-ghost" style="flex:1;color:rgba(232,237,245,.4);font-size:11px" onclick="window.tdОтменить()">❌ Отменить</button>
      <button class="btn btn-ghost" style="flex:1;color:#FF6B6B;font-size:11px" onclick="window.tdУдалить()">🗑 Удалить</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.tdСохранить()">💾 Сохранить</button>
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

window.tdВыбPts = function(pts) {
  _текущая.xpValue = pts;
  document.querySelectorAll('#td-points .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#td-points [data-pts="${pts}"]`)?.classList.add('active');
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
    cat: _текущая.cat || 'Работа',  // категория обязательна — дефолт 'Работа'
    xpValue: _текущая.xpValue || 10,
    notes: заметки,
    subtasks: (_текущая.subtasks || []).filter(s => s.text?.trim()),
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
