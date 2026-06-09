// ── TASKS SCREEN ──────────────────────────────────────────────────────────────
import { DB } from '../db.js';
import { onTaskToggled } from '../gamification.js';
import { TG } from '../telegram.js';

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
      const all      = tasks.filter(t => t.quadrant === q.key && !t.done);
      const видимые  = all.slice(0,4);
      return `<div class="quadrant-card" style="border-top:2px solid ${q.color}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:9px;font-weight:700;color:${q.color}">${q.label.split('·')[0].trim()}</div>
          <span class="num" style="font-size:12px;color:${q.color}">${all.length}</span>
        </div>
        ${видимые.map(t => `<div style="font-size:11px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;display:flex;gap:6px;align-items:flex-start" onclick="event.stopPropagation();window.toggleTask('${t.id}')">
          <div style="width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,.2);flex-shrink:0;margin-top:2px"></div>
          <span style="line-height:1.3">${t.text}</span>
        </div>`).join('')}
        ${видимые.length === 0 ? `<div style="font-size:10px;color:rgba(232,237,245,.25);text-align:center;padding:12px 0">✓ Пусто</div>` : ''}
        ${all.length > 4 ? `<div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:6px;text-align:center">+${all.length-4} ещё</div>` : ''}
      </div>`;
    }).join('')}
  </div>
  <div style="font-size:10px;color:rgba(232,237,245,.35);text-align:center;margin-top:8px;letter-spacing:.05em">
    Переключи на «📋 Список» чтобы видеть детали и категории
  </div>`;
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

window.setTaskView = function(mode) {
  viewMode = mode;
  renderTasks();
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

  DB.addTask({
    text,
    cat:      cat === 'auto' ? 'Работа' : cat,
    time:     финальноеВремя,
    quadrant: quad === 'auto' ? 'schedule' : quad,
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
