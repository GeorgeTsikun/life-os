// ── LIFE OS — ГЛАВНЫЙ МОДУЛЬ ──────────────────────────────────────────────────
import { DB } from './db.js?v=52';
import { injectUI, checkAchievements, onQuestCompleted, applyDebuffMode } from './gamification.js?v=52';
import { TG } from './telegram.js?v=52';
import { renderDash }         from './screens/dash.js?v=52';
import { renderTasks }        from './screens/tasks.js?v=52';
import { renderHealth }       from './screens/health.js?v=52';
import { renderProjects }     from './screens/projects.js?v=52';
import { renderPeople }       from './screens/people.js?v=52';
import { renderContent }      from './screens/content.js?v=52';
import { renderAchievements } from './screens/achievements.js?v=52';
import { renderOnboarding }   from './screens/onboarding.js?v=52';
import { renderAnalytics }    from './screens/analytics.js?v=52';
import * as Sync              from './supabaseSync.js?v=52';
import { openVoiceCapture }  from './voiceCapture.js?v=52';

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────
const ОНБОРДИНГ_ПРОЙДЕН = localStorage.getItem('lifeos_onboarded') === 'true'
                       || localStorage.getItem('lifeos_onboarding_skipped') === 'true';

if (ОНБОРДИНГ_ПРОЙДЕН) {
  DB.init();           // инициализация + ежедневная деградация шкал
  applyDebuffMode();   // debuff-режим если шкала < 30
}
TG.init();
injectUI(показатьТост, показатьXpFloat);

// Подключаем Supabase (асинхронно — не блокирует UI)
Sync.инициализироватьSupabase().then(async (ок) => {
  if (ок) {
    // Подтягиваем актуальные данные из облака
    await Sync.загрузитьВсё();
    // Заливаем все локальные задачи обратно в облако (чтобы бот видел то же самое)
    await Sync.pushAllLocal();
    // Перерисовываем активный таб ТОЛЬКО если онбординг уже пройден
    if (ОНБОРДИНГ_ПРОЙДЕН) {
      const активныйТаб = document.querySelector('.nav-btn.active')?.dataset?.tab;
      if (активныйТаб && window.goTab) window.goTab(null, активныйТаб);
    }
    показатьТост('☁️', 'Облако подключено', 'Синхронизация с Supabase активна', '');

    // ── ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ каждые 25 секунд ────────────────────
    // Чтобы новые задачи от бота автоматом появлялись без перезагрузки
    setInterval(async () => {
      if (document.hidden) return;          // вкладка не видна — не дёргаем
      const активныйТаб = document.querySelector('.nav-btn.active')?.dataset?.tab;
      const доЗадач = JSON.parse(localStorage.getItem('lifeos_tasks') || '[]').length;
      await Sync.загрузитьВсё();
      const послеЗадач = JSON.parse(localStorage.getItem('lifeos_tasks') || '[]').length;
      // Перерисовываем только если что-то реально поменялось
      if (доЗадач !== послеЗадач && активныйТаб && window.goTab) {
        window.goTab(null, активныйТаб);
        if (послеЗадач > доЗадач) {
          показатьТост('☁️', 'Синхронизация', `+${послеЗадач - доЗадач} новых задач из бота`, '');
        }
      }
    }, 25000);

    // ── СВАЙП-ВНИЗ ДЛЯ PULL-TO-REFRESH ─────────────────────────────────
    let startY = 0;
    const контент = document.getElementById('content');
    if (контент) {
      контент.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
      контент.addEventListener('touchend', async e => {
        const ΔY = e.changedTouches[0].clientY - startY;
        if (ΔY > 120 && контент.scrollTop === 0) {
          показатьТост('⏳', 'Синхронизация…', '', '');
          await Sync.загрузитьВсё();
          const активныйТаб = document.querySelector('.nav-btn.active')?.dataset?.tab;
          if (активныйТаб && window.goTab) window.goTab(null, активныйТаб);
        }
      }, { passive: true });
    }
  }
});

// Подписываемся на все изменения в DB → пушим в Supabase
window._дбHook = function(тип, объект) {
  if (!Sync.активен()) return;
  switch (тип) {
    case 'task':         Sync.сохранитьЗадачу(объект);             break;
    case 'task_delete':  Sync.удалитьЗадачу(объект.id);            break;
    case 'project':      Sync.сохранитьПроект(объект);             break;
    case 'profile':      Sync.сохранитьПрофиль(объект);            break;
    case 'daily':        Sync.сохранитьДневник(объект);            break;
    case 'health':       Sync.сохранитьЗдоровье(объект);           break;
    case 'ach':          Sync.разблокироватьДостижение(объект);    break;
    case 'content_item': Sync.сохранитьКонтентЭлемент(объект);     break;
    case 'content':
      if (Array.isArray(объект)) объект.forEach(x => Sync.сохранитьКонтентЭлемент(x));
      break;
    case 'expectations':
      if (Array.isArray(объект)) объект.forEach(e => Sync.сохранитьОжидание(e));
      break;
    case 'expectation':  Sync.сохранитьОжидание(объект);            break;
    case 'ideaBank':
      if (Array.isArray(объект)) объект.forEach(i => Sync.сохранитьИдею(i));
      break;
    case 'idea':         Sync.сохранитьИдею(объект);                break;
    case 'idea_delete':  Sync.удалитьИдею(объект.id);               break;
    case 'meal':         Sync.сохранитьПриёмПищи(объект);           break;
    case 'meal_delete':  Sync.удалитьПриёмПищи(объект.id);          break;
  }
};

// §3.2 — Жёсткий блок Q1 > 5: модал перебалансировки
window.showQ1Block = function() {
  const q1 = DB.getTasks().filter(t => !t.done && !t.cancelled && t.quadrant === 'do');
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:28px;margin-bottom:6px">⚠️</div>
      <div style="font-size:14px;font-weight:800;color:#FF4560;margin-bottom:4px">Искусственный кризис</div>
      <div style="font-size:11px;color:rgba(232,237,245,.55);line-height:1.5">
        Q1 переполнен (${q1.length}/5).<br>
        Перенеси минимум 3 задачи в Q2 чтобы разблокировать.
      </div>
    </div>
    <div id="q1block-list" style="margin-bottom:16px">
      ${q1.map(t => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <div style="flex:1;font-size:12px;color:#E8EDF5;line-height:1.4">${t.text}</div>
        <button onclick="window.q1MoveToQ2('${t.id}',this)"
          style="flex-shrink:0;padding:5px 10px;border-radius:8px;font-size:10px;font-weight:700;
                 border:1px solid rgba(0,245,212,.3);background:rgba(0,245,212,.08);color:#00F5D4;cursor:pointer">
          → Q2
        </button>
      </div>`).join('')}
    </div>
    <div id="q1block-counter" style="text-align:center;font-size:11px;color:rgba(232,237,245,.4);margin-bottom:12px">
      Перенесено: 0 из 3
    </div>
    <button class="btn btn-ghost" style="width:100%" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
  </div>`;
  div.setAttribute('data-moved', '0');
  document.body.appendChild(div);
};

window.q1MoveToQ2 = function(id, btn) {
  DB.updateTask(id, { quadrant: 'schedule' });
  btn.textContent = '✓';
  btn.disabled = true;
  btn.style.background = 'rgba(0,227,150,.15)';
  btn.style.color = '#00E396';
  btn.style.borderColor = 'rgba(0,227,150,.3)';
  const overlay = btn.closest('.modal-overlay');
  const moved = parseInt(overlay.getAttribute('data-moved') || '0') + 1;
  overlay.setAttribute('data-moved', moved);
  document.getElementById('q1block-counter').textContent = `Перенесено: ${moved} из 3`;
  if (moved >= 3) {
    document.getElementById('q1block-counter').innerHTML =
      '<span style="color:#00E396;font-weight:700">✅ Разблокировано! Можно добавлять Q1.</span>';
    setTimeout(() => overlay.remove(), 1200);
  }
  window.showToast?.('→ Задача перенесена в Q2', 'info');
  // Обновляем текущий экран если открыт tasks
  if (window._текущийТаб === 'tasks') ЭКРАНЫ.tasks?.();
};

let текущийТаб = 'dash';

const ЭКРАНЫ = {
  dash:         renderDash,
  tasks:        renderTasks,
  health:       renderHealth,
  content:      renderContent,
  projects:     renderProjects,
  people:       renderPeople,
  achievements: renderAchievements,
  analytics:    renderAnalytics,
};

// ── НАВИГАЦИЯ ─────────────────────────────────────────────────────────────────
window.goTab = function(кнопка, таб) {
  // Гарантируем что nav и fab видны (защита от bfcache и инлайн-стилей онбординга)
  const _nav = document.querySelector('nav');
  const _fab = document.getElementById('fab');
  if (_nav) _nav.style.display = '';
  if (_fab) _fab.style.display = '';

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (кнопка) {
    кнопка.classList.add('active');
  } else {
    document.querySelector(`[data-tab="${таб}"]`)?.classList.add('active');
  }

  уничтожитьВсеГрафики();
  текущийТаб = таб;
  window._текущийТаб = таб; // доступен глобально (для voiceCapture и др.)
  const _c = document.getElementById('content');
  if (_c) _c.dataset.tab = таб; // для десктоп-раскладки (CSS per-screen)
  window.ЭКРАНЫ = ЭКРАНЫ;   // доступен глобально
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

// Открытие аналитики (не nav-таб, а виртуальный роут — не меняет активную кнопку)
window._openAnalytics = function() {
  уничтожитьВсеГрафики();
  renderAnalytics();
  TG.hapticSelection();
};
window._goAnalyticsBack = function() {
  window.goTab(null, текущийТаб || 'dash');
  document.querySelector(`[data-tab="${текущийТаб || 'dash'}"]`)?.classList.add('active');
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

// ── window.showToast — мост для экранов (они зовут showToast(текст, тип)) ──────
// Раньше был не определён → 27 вызовов в 9 файлах молча не срабатывали.
window.showToast = function(текст, тип = 'info') {
  const иконки = { success: '✅', error: '⚠️', info: 'ℹ️', warning: '🟡' };
  показатьТост(иконки[тип] || 'ℹ️', текст, '', '');
};

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

// ── FAB — ГОЛОСОВОЙ ЗАХВАТ (с любого экрана) ──────────────────────────────────
document.getElementById('fab')?.addEventListener('click', () => {
  // На экране людей и проектов — специфичное действие
  if (текущийТаб === 'people')   { window.openAddPerson?.();  return; }
  if (текущийТаб === 'projects') { window.openAddProject?.(); return; }
  // Везде остальное — голосовой захват
  openVoiceCapture();
});

// ── ВЫПОЛНЕНИЕ КВЕСТА ─────────────────────────────────────────────────────────
// window.completeQuest — единая реализация в js/screens/dash.js
// (там есть доступ к taskId связанной задачи + XP через onQuestCompleted).

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

// ── СЕРВИС-ВОРКЕР: разрегистрировать если был ─────────────────────────────────
// SW отключён временно — он кэшировал слишком жёстко и не давал видеть новые версии.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
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

// Принудительно сбрасываем возможные inline-стили после bfcache Safari
{
  const nav = document.querySelector('nav');
  const fab = document.getElementById('fab');
  if (nav) nav.style.display = '';
  if (fab) fab.style.display = '';
}

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

// На случай возврата через back-button Safari — тоже сбрасываем
window.addEventListener('pageshow', () => {
  const ок = localStorage.getItem('lifeos_onboarded') === 'true'
          || localStorage.getItem('lifeos_onboarding_skipped') === 'true';
  if (ок) {
    const nav = document.querySelector('nav');
    const fab = document.getElementById('fab');
    if (nav && nav.style.display === 'none') {
      nav.style.display = '';
      if (fab) fab.style.display = '';
      // Если онбординг сейчас на экране — перерисуем dash
      if (window.goTab) window.goTab(null, 'dash');
    }
  }
});

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
