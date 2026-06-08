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

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────
DB.init();
TG.init();
injectUI(показатьТост, показатьXpFloat);

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
checkAchievements();
обработатьДиплинк();
