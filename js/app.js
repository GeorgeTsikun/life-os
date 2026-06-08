// ── LIFE OS — ГЛАВНЫЙ МОДУЛЬ ──────────────────────────────────────────────────
import { DB } from './db.js';
import { injectUI, checkAchievements, onQuestCompleted } from './gamification.js';
import { TG } from './telegram.js';
import { renderDash }         from './screens/dash.js';
import { renderTasks }        from './screens/tasks.js';
import { renderHealth }       from './screens/health.js';
import { renderProjects }     from './screens/projects.js';
import { renderPeople }       from './screens/people.js';
import { renderAchievements } from './screens/achievements.js';
import { renderOnboarding }   from './screens/onboarding.js';
import * as Sync              from './supabaseSync.js';

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────
const ОНБОРДИНГ_ПРОЙДЕН = localStorage.getItem('lifeos_onboarded') === 'true'
                       || localStorage.getItem('lifeos_onboarding_skipped') === 'true';

if (ОНБОРДИНГ_ПРОЙДЕН) DB.init();
TG.init();
injectUI(показатьТост, показатьXpFloat);

// Подключаем Supabase (асинхронно — не блокирует UI)
Sync.инициализироватьSupabase().then(async (ок) => {
  if (ок) {
    // Подтягиваем актуальные данные из облака
    await Sync.загрузитьВсё();
    // Если уже отрисован экран — перерисовываем с обновлёнными данными
    const активныйТаб = document.querySelector('.nav-btn.active')?.dataset?.tab;
    if (активныйТаб && window.goTab) window.goTab(null, активныйТаб);
    показатьТост('☁️', 'Облако подключено', 'Синхронизация с Supabase активна', '');
  }
});

// Подписываемся на все изменения в DB → пушим в Supabase
window._дбHook = function(тип, объект) {
  if (!Sync.активен()) return;
  switch (тип) {
    case 'task':     Sync.сохранитьЗадачу(объект);     break;
    case 'project':  Sync.сохранитьПроект(объект);     break;
    case 'profile':  Sync.сохранитьПрофиль(объект);    break;
    case 'daily':    Sync.сохранитьДневник(объект);    break;
    case 'health':   Sync.сохранитьЗдоровье(объект);   break;
    case 'ach':      Sync.разблокироватьДостижение(объект); break;
  }
};

let текущийТаб = 'dash';

const ЭКРАНЫ = {
  dash:         renderDash,
  tasks:        renderTasks,
  health:       renderHealth,
  projects:     renderProjects,
  people:       renderPeople,
  achievements: renderAchievements,
};

// ── НАВИГАЦИЯ ─────────────────────────────────────────────────────────────────
window.goTab = function(кнопка, таб) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (кнопка) {
    кнопка.classList.add('active');
  } else {
    document.querySelector(`[data-tab="${таб}"]`)?.classList.add('active');
  }

  уничтожитьВсеГрафики();
  текущийТаб = таб;
  const фн = ЭКРАНЫ[таб];
  if (фн) фн();
  TG.hapticSelection();
  document.getElementById('content').scrollTop = 0;
};

window.goBack = function() {
  window.goTab(null, 'dash');
  document.querySelector('[data-tab="dash"]')?.classList.add('active');
  TG.hideBackButton();
};

// ── ОЧИСТКА ГРАФИКОВ ──────────────────────────────────────────────────────────
const _графики = {};

window._registerChart = function(id, экземпляр) {
  _графики[id] = экземпляр;
};

function уничтожитьВсеГрафики() {
  Object.values(_графики).forEach(г => { try { г.destroy(); } catch {} });
  Object.keys(_графики).forEach(к => delete _графики[к]);
}

// ── УВЕДОМЛЕНИЯ (тосты) ───────────────────────────────────────────────────────
function показатьТост(иконка, заголовок, текст, xp = '', достижение = false) {
  const контейнер = document.getElementById('toast-container');
  if (!контейнер) return;

  const эл = document.createElement('div');
  эл.className = `toast${достижение ? ' achievement' : ''}`;
  эл.innerHTML = `
    <div class="toast-icon">${иконка}</div>
    <div class="toast-body">
      <div class="toast-title">${заголовок}</div>
      ${текст ? `<div class="toast-sub">${текст}</div>` : ''}
    </div>
    ${xp ? `<div class="toast-xp">${xp}</div>` : ''}
  `;
  контейнер.appendChild(эл);
  if (достижение) TG.hapticSuccess();
  setTimeout(() => эл.remove(), 3500);
}

// ── ВСПЛЫВАЮЩИЙ XP ────────────────────────────────────────────────────────────
function показатьXpFloat(текст) {
  const эл = document.createElement('div');
  эл.className = 'xp-float';
  эл.textContent = текст;
  эл.style.bottom = 'calc(var(--nav-h) + 72px)';
  эл.style.right  = '24px';
  document.body.appendChild(эл);
  setTimeout(() => эл.remove(), 1000);
}

// ── FAB — БЫСТРОЕ ДОБАВЛЕНИЕ ──────────────────────────────────────────────────
document.getElementById('fab')?.addEventListener('click', () => {
  if (текущийТаб === 'tasks')    { window.openAddTask();    return; }
  if (текущийТаб === 'people')   { window.openAddPerson();  return; }
  if (текущийТаб === 'projects') { window.openAddProject(); return; }
  // По умолчанию — открыть задачи
  window.goTab(null, 'tasks');
  document.querySelector('[data-tab="tasks"]')?.classList.add('active');
  document.querySelector('[data-tab="dash"]')?.classList.remove('active');
  setTimeout(() => window.openAddTask(), 50);
});

// ── ВЫПОЛНЕНИЕ КВЕСТА ─────────────────────────────────────────────────────────
window.completeQuest = function(id) {
  const квест = DB.completeQuest(id);
  if (квест) {
    onQuestCompleted(квест);
    const фн = ЭКРАНЫ[текущийТаб];
    if (фн) фн();
  }
  TG.hapticSuccess();
};

// ── PWA — УСТАНОВКА ───────────────────────────────────────────────────────────
let отложеннаяУстановка;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  отложеннаяУстановка = e;
  setTimeout(() => {
    if (отложеннаяУстановка) {
      показатьТост('📲', 'Установи LIFE OS', 'Добавь на главный экран для лучшего опыта', '');
    }
  }, 30000);
});

// ── СЕРВИС-ВОРКЕР ─────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── ДИПЛИНК ИЗ URL ────────────────────────────────────────────────────────────
function обработатьДиплинк() {
  const параметры = new URLSearchParams(window.location.search);
  const таб = параметры.get('tab');
  if (таб && ЭКРАНЫ[таб]) {
    window.goTab(null, таб);
    document.querySelector(`[data-tab="${таб}"]`)?.classList.add('active');
    document.querySelector('[data-tab="dash"]')?.classList.remove('active');
    if (параметры.get('action') === 'add') setTimeout(() => window.openAddTask(), 100);
    return;
  }
  window.goTab(null, 'dash');
  document.querySelector('[data-tab="dash"]')?.classList.add('active');
}

// ── ЗАПУСК ────────────────────────────────────────────────────────────────────
// ES-модули отложены — DOM уже готов к моменту выполнения
if (!ОНБОРДИНГ_ПРОЙДЕН) {
  // Скрываем нижнюю навигацию и FAB на время онбординга
  document.querySelector('nav').style.display = 'none';
  document.getElementById('fab').style.display = 'none';
  renderOnboarding();
} else {
  checkAchievements();
  обработатьДиплинк();
  смонтироватьAIКнопку();
}

// ── ПЛАВАЮЩАЯ AI-КНОПКА (чат с директором) ────────────────────────────────────
function смонтироватьAIКнопку() {
  if (document.getElementById('ai-fab')) return;
  const кнопка = document.createElement('button');
  кнопка.id = 'ai-fab';
  кнопка.innerHTML = '🧠';
  кнопка.title = 'AI-директор';
  кнопка.style.cssText = `
    position:absolute;bottom:calc(var(--nav-h) + 76px);right:16px;
    width:46px;height:46px;border-radius:50%;
    background:linear-gradient(135deg,#7B61FF,#FFD700);
    border:none;cursor:pointer;font-size:20px;
    box-shadow:0 4px 16px rgba(123,97,255,.4);z-index:99;`;
  кнопка.onclick = открытьAIЧат;
  document.getElementById('app').appendChild(кнопка);
}

function открытьAIЧат() {
  const существ = document.getElementById('ai-chat');
  if (существ) { существ.remove(); return; }

  const div = document.createElement('div');
  div.id = 'ai-chat';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet" style="max-height:75vh;display:flex;flex-direction:column">
    <div class="modal-handle"></div>
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div class="modal-title" style="margin:0">🧠 AI-директор</div>
      <button onclick="document.getElementById('ai-chat').remove()" style="background:none;border:none;color:rgba(232,237,245,.5);font-size:18px;cursor:pointer">×</button>
    </div>
    <div id="ai-messages" style="flex:1;overflow-y:auto;margin-bottom:12px;display:flex;flex-direction:column;gap:8px">
      <div style="background:rgba(123,97,255,.08);border:1px solid rgba(123,97,255,.18);border-radius:10px;padding:10px 12px;font-size:13px">
        Привет. Спроси что угодно про свою жизнь, задачи, проекты, людей. Я держу весь контекст.
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <input id="ai-input" class="input" placeholder="напр.: как мой месяц?" onkeydown="if(event.key==='Enter') window.aiОтправить()">
      <button class="btn btn-teal" onclick="window.aiОтправить()">→</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
}

window.aiОтправить = async function() {
  const inp = document.getElementById('ai-input');
  const сообщение = inp.value.trim();
  if (!сообщение) return;
  inp.value = '';

  const messages = document.getElementById('ai-messages');
  messages.insertAdjacentHTML('beforeend', `
    <div style="background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.18);border-radius:10px;padding:10px 12px;font-size:13px;align-self:flex-end;max-width:85%">
      ${сообщение}
    </div>
    <div id="ai-loading" style="font-size:11px;color:rgba(232,237,245,.4);padding:6px">Думаю...</div>
  `);
  messages.scrollTop = messages.scrollHeight;

  try {
    const контекст = {
      профиль: DB.getProfile(),
      проектов: DB.getProjects().length,
      задач_открыто: DB.getTasks().filter(t=>!t.done).length,
      страйк: DB.getProfile().streak,
      энергия: DB.getDailyLog().energy,
    };
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ сообщение, контекст }),
    });
    const { ответ, error } = await res.json();
    document.getElementById('ai-loading')?.remove();
    messages.insertAdjacentHTML('beforeend', `
      <div style="background:rgba(123,97,255,.08);border:1px solid rgba(123,97,255,.18);border-radius:10px;padding:10px 12px;font-size:13px;max-width:90%">
        ${error || ответ}
      </div>
    `);
    messages.scrollTop = messages.scrollHeight;
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    messages.insertAdjacentHTML('beforeend', `<div style="color:#FF6B6B;font-size:11px">Ошибка: ${err.message}</div>`);
  }
};
