// ── HEALTH SCREEN (Health / Sport / Nutrition sub-tabs) ───────────────────────
import { DB } from '../db.js?v=83';
import { onWorkoutLogged, onNutritionUpdated } from '../gamification.js?v=83';
import { TG } from '../telegram.js?v=83';
import { PLAN_GOAL, STAGES, DAY_KEYS, DAY_LABELS, stageForWeek, planState, PLAN_WEEKS } from '../data/trainingPlan.js?v=83';

let sleepChart, pulseChart, hrvChart, revenueChart;
let healthTab = 'health';

export function renderHealth(tab) {
  if (tab) healthTab = tab;
  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
    <div class="health-header">
      <div>
        <div class="num" style="font-size:16px">ЗДОРОВЬЕ</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">Тело · Спорт · Питание</div>
      </div>
      <div class="sync-chip live">
        <div style="width:6px;height:6px;border-radius:50%;background:#00F5D4;animation:pulseA 2s infinite"></div>
        Apple Health
      </div>
    </div>
    <div class="toggle-row">
      <button class="toggle-btn${healthTab==='health'?' active':''}" onclick="window.switchHealthTab('health')">❤️ Здоровье</button>
      <button class="toggle-btn${healthTab==='sport'?' active':''}" onclick="window.switchHealthTab('sport')">💪 Спорт</button>
      <button class="toggle-btn${healthTab==='nutrition'?' active':''}" onclick="window.switchHealthTab('nutrition')">🥗 Питание</button>
    </div>
    <div id="health-body"></div>
    <div style="height:8px"></div>
  </div>`;

  renderHealthBody();
  TG.hideBackButton();
  TG.hideMainButton();
}

function renderHealthBody() {
  const body = document.getElementById('health-body');
  if (!body) return;
  destroyHealthCharts();
  if (healthTab === 'health')    { body.innerHTML = healthTabHTML(); mountHealthCharts(); }
  else if (healthTab === 'sport'){ body.innerHTML = sportTabHTML(); }
  else                           { body.innerHTML = nutritionTabHTML(); }
}

// ── §3.3 ЦИКЛИЧЕСКИЕ ЧЕКАПЫ ──────────────────────────────────────────────────
function renderCheckups() {
  const checkups = DB.getCheckups();
  const today    = new Date();

  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="sec-label" style="margin:0">⏰ ЧЕКАПЫ ЖИЗНИ</div>
      <span style="font-size:9px;color:rgba(232,237,245,.3)">раз в N дней</span>
    </div>
    ${checkups.map(c => {
      const nextDue = c.lastDone
        ? new Date(new Date(c.lastDone).getTime() + c.interval * 86400000)
        : null;
      const diffDays = nextDue ? Math.ceil((nextDue - today) / 86400000) : null;
      const overdue  = diffDays !== null && diffDays < 0;
      const soon     = diffDays !== null && diffDays <= 7;
      const color    = overdue ? '#FF4560' : soon ? '#FFD700' : '#00E396';
      const dot      = overdue ? '🔴' : soon ? '🟡' : c.lastDone ? '🟢' : '⚪';
      const label    = overdue
        ? `Просрочено ${Math.abs(diffDays)}д!`
        : diffDays === null ? 'Нет данных'
        : diffDays <= 0     ? 'Сегодня!'
        : diffDays === 1    ? 'Завтра'
        : diffDays <= 7     ? `${diffDays} дн.`
        : nextDue.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });

      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:20px;flex-shrink:0">${c.emoji}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:#E8EDF5">${c.name}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:1px">каждые ${c.interval} дн.</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:10px;font-weight:700;color:${color}">${dot} ${label}</div>
          ${c.lastDone ? `<div style="font-size:9px;color:rgba(232,237,245,.25);margin-top:1px">Был: ${new Date(c.lastDone).toLocaleDateString('ru-RU', {day:'numeric',month:'short'})}</div>` : ''}
        </div>
        <button onclick="window.markCheckupDone('${c.id}')"
          style="flex-shrink:0;padding:5px 8px;border-radius:8px;font-size:10px;font-weight:700;
                 border:1px solid ${color}44;background:${color}11;color:${color};cursor:pointer">✓</button>
      </div>`;
    }).join('')}
  </div>`;
}

window.markCheckupDone = function(id) {
  DB.markCheckupDone(id);
  renderHealthBody();
};

// ── HEALTH TAB ────────────────────────────────────────────────────────────────
function healthTabHTML() {
  const h = DB.getHealth();
  return `
  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">🏃 КОЛЬЦА АКТИВНОСТИ</div>
    <div class="activity-rings-row">
      ${ringHTML(h.move||78,'#FF4560',`${h.move||78}%`,'Движение')}
      ${ringHTML(h.exercise||65,'#00E396',`${h.exercise||65}%`,'Упражн.')}
      ${ringHTML(h.stand||90,'#00C9FF',`${h.stand||90}%`,'Стояние')}
    </div>
    <div class="grid3">
      ${[
        {l:'Шаги',v:(h.steps||8420).toLocaleString(),t:'10 000',c:'#FF4560'},
        {l:'Калории',v:h.calories||420,t:'600',c:'#00E396'},
        {l:'Км',v:h.km||6.2,t:'8',c:'#00C9FF'},
      ].map(s=>`<div style="text-align:center">
        <div class="num" style="font-size:14px;color:${s.c}">${s.v}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.35)">${s.l}</div>
        <div style="font-size:8px;color:rgba(232,237,245,.25);margin-top:1px">цель ${s.t}</div>
      </div>`).join('')}
    </div>
  </div>

  <div class="card purple" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div>
        <div class="sec-label" style="margin:0 0 4px">🌙 СОН</div>
        <div class="num" style="font-size:26px;color:#7B61FF">${h.sleep?.hours||7.2}ч</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${h.sleep?.bedtime||'23:15'} → ${h.sleep?.wake||'06:27'}</div>
      </div>
      <div class="sleep-stats">
        ${[
          {l:'Качество',v:`${h.sleep?.quality||85}%`,c:'#00E396'},
          {l:'Глубокий',v:`${h.sleep?.deep||22}%`,c:'#7B61FF'},
          {l:'REM',v:`${h.sleep?.rem||18}%`,c:'#FF9F43'},
        ].map(s=>`<div class="row" style="gap:8px;justify-content:flex-end">
          <div style="font-size:10px;color:rgba(232,237,245,.4)">${s.l}</div>
          <div style="font-size:12px;font-weight:700;color:${s.c}">${s.v}</div>
        </div>`).join('')}
      </div>
    </div>
    <div style="height:80px"><canvas id="sleep-chart"></canvas></div>
  </div>

  <div class="grid2" style="margin-bottom:12px">
    <div class="card" style="margin:0">
      <div class="sec-label">❤️ ПУЛЬС ПОКОЯ</div>
      <div class="num" style="font-size:26px;color:#FF4560">${h.restingHr||58}</div>
      <div style="font-size:9px;color:rgba(232,237,245,.35)">уд/мин</div>
      <div style="height:45px;margin-top:8px"><canvas id="pulse-chart"></canvas></div>
    </div>
    <div class="card" style="margin:0">
      <div class="sec-label">📊 ВСР (HRV)</div>
      <div class="num" style="font-size:26px;color:#00E396">${h.hrv||58}</div>
      <div style="font-size:9px;color:rgba(232,237,245,.35)">мс · ${(h.hrv||58)>=50?'хорошо':'норма'}</div>
      <div style="height:45px;margin-top:8px"><canvas id="hrv-chart"></canvas></div>
    </div>
  </div>

  ${renderCheckups()}

  <div class="card" id="ai-health-card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🤖 AI-АНАЛИЗ</div>
      <button onclick="window.loadHealthAI()" id="ai-health-btn" style="font-size:9px;padding:3px 9px;border-radius:10px;border:1px solid rgba(0,245,212,.3);background:rgba(0,245,212,.06);color:#00F5D4;cursor:pointer">Обновить</button>
    </div>
    <div id="ai-health-body" style="font-size:11px;color:rgba(232,237,245,.45);text-align:center;padding:8px 0">
      Нажмите «Обновить» для AI-анализа состояния
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">📱 APPLE HEALTH</div>
    <div style="padding:12px;background:rgba(255,255,255,.02);border-radius:10px;text-align:center">
      <div style="font-size:12px;color:rgba(232,237,245,.5);margin-bottom:8px">Для автосинхронизации создайте iOS Shortcut</div>
      <button class="btn btn-teal" style="font-size:10px" onclick="window.showHealthBridge()">📲 Инструкция по настройке</button>
    </div>
  </div>`;
}

// ── SPORT TAB ────────────────────────────────────────────────────────────────
// ── ПЛАН ТРАНСФОРМАЦИИ (10 недель) ───────────────────────────────────────────
function transformBlockHTML() {
  const startStr = localStorage.getItem('lifeos_plan_start') || undefined;
  const st = planState(startStr);
  const before = localStorage.getItem('lifeos_body_before') || '';
  const target = localStorage.getItem('lifeos_body_target') || '';
  const stage  = stageForWeek(st.week);
  const stageNum = STAGES.indexOf(stage) + 1;

  const photoSlot = (key, label, src) => `<div class="bp-slot" onclick="window.uploadBodyPhoto('${key}')">
    ${src ? `<img src="${src}" alt="${label}">` : `<div class="bp-empty"><span style="font-size:26px">📷</span><span style="font-size:10px">Загрузить</span></div>`}
    <span class="bp-label">${label}</span>
  </div>`;

  // ── Шапка: цель + фото ───────────────────────────────────────────────────
  const goalCard = `<div class="card teal" style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="sec-label" style="margin:0">🎯 ПЛАН ТРАНСФОРМАЦИИ · 10 НЕДЕЛЬ</div>
      <button onclick="window.openFullPlan()" style="font-size:10px;padding:4px 10px;border-radius:9px;border:1px solid rgba(0,245,212,.3);background:rgba(0,245,212,.06);color:#00F5D4;cursor:pointer">Весь план</button>
    </div>
    <div class="bp-photos">
      ${photoSlot('before', '«До» — сейчас', before)}
      <div class="bp-arrow">→</div>
      ${photoSlot('target', 'Цель', target)}
    </div>
    <div style="font-size:11px;color:rgba(232,237,245,.6);line-height:1.55;margin-top:12px">${PLAN_GOAL.summary}</div>
  </div>`;

  // ── Прогресс по неделям ────────────────────────────────────────────────────
  let statusBlock = '';
  if (st.status === 'before') {
    const startDate = st.start.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
    statusBlock = `<div class="card gold" style="margin-bottom:14px;text-align:center">
      <div style="font-size:30px;margin-bottom:6px">🚀</div>
      <div style="font-size:15px;font-weight:800;color:#F5B942">Старт в понедельник, ${startDate}</div>
      <div style="font-size:12px;color:rgba(232,237,245,.55);margin-top:4px">Через ${st.daysToStart} ${st.daysToStart===1?'день':'дн.'} — этап 1: «${STAGES[0].name}». Отдохни в выходные, в понедельник погнали.</div>
    </div>`;
  } else if (st.status === 'done') {
    statusBlock = `<div class="card teal" style="margin-bottom:14px;text-align:center">
      <div style="font-size:30px;margin-bottom:6px">🏆</div>
      <div style="font-size:15px;font-weight:800;color:#00F5D4">10 недель пройдено!</div>
      <div style="font-size:12px;color:rgba(232,237,245,.55);margin-top:4px">Сделай финальное фото с пампом и сравни с «До». Загрузи новое фото в слот.</div>
    </div>`;
  } else {
    const pct = Math.round((st.week / PLAN_WEEKS) * 100);
    statusBlock = `<div class="card" style="margin-bottom:14px">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <div><span class="num" style="font-size:18px;color:#00F5D4">Неделя ${st.week}</span><span style="font-size:12px;color:rgba(232,237,245,.4)"> / ${PLAN_WEEKS}</span></div>
        <span style="font-size:11px;padding:3px 10px;border-radius:10px;background:rgba(124,58,237,.15);color:#9B7CFF;border:1px solid rgba(124,58,237,.3)">Этап ${stageNum}: ${stage.name}</span>
      </div>
      <div class="prog-bar" style="height:7px"><div class="prog-fill" style="width:${pct}%;background:linear-gradient(90deg,#00F5D4,#7C3AED)"></div></div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:6px">${stage.subtitle}</div>
    </div>`;
  }

  // ── Тренировка дня / превью недели ─────────────────────────────────────────
  let todayCard = '';
  const renderDay = (day, dayKey, isToday) => {
    if (day.rest) {
      return `<div class="card" style="margin-bottom:14px;text-align:center">
        <div style="font-size:26px;margin-bottom:4px">${day.emoji}</div>
        <div style="font-size:14px;font-weight:700;color:#9B7CFF">${isToday?'Сегодня — ':''}${day.title}</div>
        ${day.note?`<div style="font-size:11px;color:rgba(232,237,245,.5);margin-top:4px">${day.note}</div>`:''}
      </div>`;
    }
    const dateKey = new Date().toISOString().split('T')[0];
    const doneEx = JSON.parse(localStorage.getItem('lifeos_plan_ex_' + dateKey) || '[]');
    return `<div class="card" style="margin-bottom:14px;border-left:3px solid ${day.color}">
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:10px;color:rgba(232,237,245,.4);letter-spacing:.06em">${isToday?'ТРЕНИРОВКА СЕГОДНЯ':'ТРЕНИРОВКА'}</div>
          <div style="font-size:15px;font-weight:800;color:${day.color};margin-top:2px">${day.emoji} ${day.title}</div>
        </div>
        <span style="font-size:11px;color:rgba(232,237,245,.4)">${day.exercises.length} упр.</span>
      </div>
      <div>
        ${day.exercises.map((e, i) => {
          const done = doneEx.includes(i);
          return `<div onclick="window.togglePlanExercise(${i})" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer">
            <div class="checkbox${done?' checked':''}" style="${done?`background:${day.color};border-color:${day.color};color:#000`:''}">${done?'✓':''}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:${done?'rgba(232,237,245,.4)':'#E8EDF5'};${done?'text-decoration:line-through':''}">${e.n}</div>
            </div>
            <div class="num" style="font-size:11px;color:${day.color};flex-shrink:0">${e.s}</div>
          </div>`;
        }).join('')}
      </div>
      <button class="btn btn-teal" style="width:100%;margin-top:14px;padding:12px" onclick="window.completeTodayWorkout('${day.title.replace(/'/g,'')}','${day.emoji}')">✓ Записать тренировку (+XP)</button>
    </div>`;
  };

  if (st.status === 'active') {
    todayCard = renderDay(stage.days[st.dayKey], st.dayKey, true);
  } else if (st.status === 'before') {
    todayCard = renderDay(STAGES[0].days.mon, 'mon', false);
  }

  // ── Неделя тренировок — карточки дней с иконками (по сплиту этапа) ──────────
  const todayKey = st.status === 'active' ? st.dayKey : null;
  const gymDays  = DB.getGymDays();
  const workouts = DB.getWorkouts();
  const monthCount = workouts.filter(w => { const d = new Date(w.date); return d.getMonth() === new Date().getMonth(); }).length;

  const dayShort = (d) => d.rest ? 'ОТДЫХ'
    : d.title.split(/[+(·]/)[0].trim().toUpperCase();
  const dayDur = (d) => d.rest ? '—'
    : /кардио|плаван|сапборд|топка|велосипед/i.test(d.title) ? '45 мин' : '55 мин';

  const splitCard = `<div class="card" style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div class="sec-label" style="margin:0">💪 НЕДЕЛЯ ТРЕНИРОВОК · ЭТАП ${stageNum}</div>
    </div>
    <div class="wk-grid">
      ${DAY_KEYS.map((k, i) => {
        const d = stage.days[k];
        const isToday = k === todayKey;
        const done = !!gymDays[i];
        return `<div class="wk-day${isToday?' today':''}${done?' done':''}" style="${isToday?`border-color:${d.color}aa;box-shadow:0 0 16px ${d.color}3a`:''}">
          <div class="wk-day-label">${DAY_LABELS[k]}</div>
          <div class="wk-day-icon" style="${d.rest?'opacity:.4':''}">${d.emoji}</div>
          <div class="wk-day-type" style="color:${d.rest?'rgba(232,237,245,.4)':d.color}">${dayShort(d)}</div>
          <div class="wk-day-dur">${dayDur(d)}</div>
          ${d.rest
            ? `<div class="wk-check rest">—</div>`
            : `<button class="wk-check${done?' done':''}" onclick="event.stopPropagation();window.toggleGymDay(${i})" style="${done?`background:${d.color};border-color:${d.color};color:#031`:''}">${done?'✓':''}</button>`}
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:14px">
      <div class="row" style="justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:rgba(232,237,245,.45)">Месяц: ${monthCount} тренировок</span>
        <span style="font-size:11px;color:#00F5D4">цель 16</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${Math.min((monthCount/16)*100,100)}%;background:linear-gradient(90deg,#00F5D4,#7C3AED);box-shadow:0 0 6px rgba(0,245,212,.4)"></div></div>
    </div>
  </div>`;

  // ── Питание под план ───────────────────────────────────────────────────────
  const nutCard = `<div class="card purple" style="margin-bottom:14px">
    <div class="sec-label">🍖 ПИТАНИЕ ПОД ПЛАН</div>
    ${PLAN_GOAL.nutrition.map(n => `<div style="display:flex;gap:10px;align-items:flex-start;padding:6px 0">
      <span style="font-size:16px;flex-shrink:0">${n.icon}</span>
      <span style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.5">${n.text}</span>
    </div>`).join('')}
  </div>`;

  return `${goalCard}${statusBlock}${todayCard}${splitCard}${nutCard}${sportLegacyHTML()}`;
}

function sportTabHTML() {
  return transformBlockHTML();
}

// Кнопка записи + журнал последних тренировок (неделя теперь в splitCard)
function sportLegacyHTML() {
  const workouts = DB.getWorkouts();

  return `
  <button class="btn btn-teal" style="width:100%;margin-bottom:14px;padding:13px" onclick="window.openLogWorkout()">
    + Записать тренировку вручную
  </button>

  <div class="card" style="margin-bottom:14px">
    <div class="sec-label">📋 ПОСЛЕДНИЕ ТРЕНИРОВКИ</div>
    ${workouts.slice(0,6).map(w=>`<div class="workout-item">
      <div class="workout-type-icon">${w.emoji||'🏋️'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${w.type}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4)">${w.date}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:12px;color:#00F5D4">${w.duration} мин${w.calories?` · 🔥 ${w.calories}`:''}</div>
        <div style="font-size:10px;color:#F5B942">+${w.xp} XP</div>
      </div>
    </div>`).join('')}
    ${workouts.length === 0 ? '<div style="text-align:center;padding:16px 0;font-size:12px;color:rgba(232,237,245,.3)">Пока пусто. Отметь тренировку дня выше 👆</div>' : ''}
  </div>`;
}

// ── ТИПЫ ПРИЁМОВ ПИЩИ ─────────────────────────────────────────────────────────
const MEAL_TYPES = {
  breakfast: { label:'Завтрак', icon:'☀️',  color:'#F5B942' },
  lunch:     { label:'Обед',    icon:'🍽️', color:'#FF9F43' },
  dinner:    { label:'Ужин',    icon:'🌙',  color:'#7C3AED' },
  snack:     { label:'Перекус', icon:'🍎',  color:'#FF5C8A' },
};
const MEAL_ORDER = ['breakfast','lunch','dinner','snack'];

// Мини-спарклайн (инлайн SVG, без Chart.js — дёшево для 5 графиков)
function sparkline(data, color, h = 38) {
  const w = 120;
  const vals = data.length ? data : [0];
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = vals.length > 1 ? (i / (vals.length - 1)) * w : w / 2;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = pts.join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".35"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${area}" fill="url(#${id})"/>
    <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${color}80)"/>
  </svg>`;
}

// ── Журнал питания: выбранный день (0 = сегодня) ─────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function selectedDate() {
  const d = new Date(); d.setDate(d.getDate() - (window._nutDateOff || 0)); return d;
}
function strOf(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function currentDayMeals() { return DB.getMealsForDate(selectedDate()); }
window.nutDateShift = function(delta) {
  window._nutDateOff = Math.max(0, (window._nutDateOff || 0) + delta);
  renderHealth('nutrition');
  TG.hapticSelection();
};

// ── NUTRITION TAB ─────────────────────────────────────────────────────────────
function nutritionTabHTML() {
  const n = DB.getNutrition();
  const sel = selectedDate();
  const isToday = (window._nutDateOff || 0) === 0;
  window._nutDateStr = strOf(sel);
  const meals = currentDayMeals();
  const score = DB.nutritionScore();

  const cG = n.caloriesGoal || 2200, pG = n.proteinGoal || 140, fG = n.fatGoal || 70, crbG = n.carbsGoal || 220;
  const filledGlasses = Math.min(10, Math.round((n.water || 0) / 0.25));

  // ── HERO (Cal AI): осталось калорий + кольца макросов ─────────────────────
  const calLeft = Math.max(0, cG - (n.calories || 0));
  const calPct  = Math.min(100, Math.round(((n.calories || 0) / Math.max(cG, 1)) * 100));
  const over    = (n.calories || 0) > cG;
  const R = 54, C = 2 * Math.PI * R, OFF = C - (calPct / 100) * C;
  const ringMacro = (val, goal, color, letter) => {
    const left = Math.max(0, goal - val);
    const pct  = Math.min(100, Math.round((val / Math.max(goal, 1)) * 100));
    const r = 22, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="position:relative;width:58px;height:58px">
        <svg width="58" height="58">
          <circle cx="29" cy="29" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="5"/>
          <circle cx="29" cy="29" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 29 29)"
            style="filter:drop-shadow(0 0 4px ${color});transition:stroke-dashoffset .6s"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${color}">${letter}</div>
      </div>
      <span style="font-size:11px;font-weight:700;color:#E8EDF5">${left}<span style="font-size:9px;color:rgba(232,237,245,.4);font-weight:400">г</span></span>
      <span style="font-size:8px;color:rgba(232,237,245,.35)">осталось</span>
    </div>`;
  };
  const heroCard = `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🔥 СЕГОДНЯ</div>
      <button onclick="window.openGoalsModal()" style="font-size:10px;color:#00D4FF;background:none;border:1px solid rgba(0,212,255,.25);border-radius:8px;padding:4px 9px;cursor:pointer">⚙️ Цели</button>
    </div>
    <div style="display:flex;align-items:center;gap:18px">
      <div style="position:relative;width:130px;height:130px;flex-shrink:0">
        <svg width="130" height="130">
          <circle cx="65" cy="65" r="${R}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="10"/>
          <circle cx="65" cy="65" r="${R}" fill="none" stroke="${over ? '#FF5C8A' : '#00E396'}" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${OFF.toFixed(1)}" transform="rotate(-90 65 65)"
            style="filter:drop-shadow(0 0 8px ${over ? '#FF5C8A' : '#00E396'});transition:stroke-dashoffset .6s"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span class="num" style="font-size:30px;font-weight:900;color:${over ? '#FF5C8A' : '#fff'};line-height:1">${over ? '+' + ((n.calories||0)-cG) : calLeft}</span>
          <span style="font-size:9px;color:rgba(232,237,245,.45);margin-top:2px">${over ? 'перебор ккал' : 'ккал осталось'}</span>
        </div>
      </div>
      <div style="flex:1;display:flex;justify-content:space-around">
        ${ringMacro(n.protein||0, pG, '#FF9F43', 'Б')}
        ${ringMacro(n.carbs||0, crbG, '#F5B942', 'У')}
        ${ringMacro(n.fat||0, fG, '#7C3AED', 'Ж')}
      </div>
    </div>
    ${!n.goalsMeta ? `<button onclick="window.openGoalsModal()" style="width:100%;margin-top:12px;padding:9px;border-radius:10px;border:1px solid rgba(245,185,66,.3);background:rgba(245,185,66,.08);color:#F5B942;font-size:11px;cursor:pointer">⚠️ Цели по умолчанию (${cG} ккал) — задай свои под себя →</button>` : ''}
  </div>`;

  // ── 3 ВЕРХНИЕ КАРТЫ: ВОДА / КБЖУ / БАЛЛ ───────────────────────────────────
  const waterCard = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:12px">
      <div class="sec-label" style="margin:0">💧 ВОДА</div>
      <div><span class="num" style="font-size:22px;color:#00D4FF">${(n.water*1000).toFixed(0)}</span><span style="font-size:11px;color:rgba(232,237,245,.4)"> / ${(n.waterGoal*1000).toFixed(0)} мл</span></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">
      ${Array.from({length:10},(_,i)=>{const done=i<filledGlasses;return `<button onclick="window.setWaterGlasses(${i+1})" style="flex:1;min-width:calc(10% - 5px);aspect-ratio:1;border-radius:10px;border:1.5px solid ${done?'#00D4FF':'rgba(255,255,255,.1)'};background:${done?'rgba(0,212,255,.18)':'rgba(255,255,255,.03)'};font-size:15px;cursor:pointer;transition:all .15s;box-shadow:${done?'0 0 8px rgba(0,212,255,.3)':'none'}">${done?'💧':'○'}</button>`;}).join('')}
    </div>
    <div class="row" style="gap:6px">
      <button class="btn btn-ghost" style="flex:1;font-size:11px" onclick="window.addWater(-0.25)">− стакан</button>
      <button class="btn btn-teal" style="flex:2;font-size:11px" onclick="window.addWater(0.25)">+ стакан 250мл</button>
      <button class="btn btn-ghost" style="flex:1;font-size:11px" onclick="window.addWater(0.5)">+ 500мл</button>
    </div>
    <div style="font-size:10px;color:rgba(232,237,245,.35);margin-top:8px;text-align:center">💧 Бот напомнит 5× за день (10:00 · 12:30 · 15:00 · 17:30 · 20:00) — размазываем 2.5л</div>
  </div>`;

  const macroBar = (val, goal, color, label) => {
    const pct = Math.min((val / Math.max(goal,1)) * 100, 100);
    return `<div style="margin-bottom:10px">
      <div class="row" style="justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;color:rgba(232,237,245,.6)">${label}</span>
        <span style="font-size:11px;font-weight:700;color:${color}">${val}<span style="font-weight:400;color:rgba(232,237,245,.35)"> / ${goal} г</span></span>
      </div>
      <div style="height:7px;border-radius:4px;background:rgba(255,255,255,.07)"><div style="height:100%;border-radius:4px;width:${pct.toFixed(1)}%;background:${color};box-shadow:0 0 6px ${color}66;transition:width .4s"></div></div>
    </div>`;
  };
  const kbjuCard = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:14px">
      <div class="sec-label" style="margin:0">🍽 КБЖУ</div>
      <div><span class="num" style="font-size:22px;color:#00E396">${n.calories||0}</span><span style="font-size:11px;color:rgba(232,237,245,.4)"> / ${cG} ккал</span></div>
    </div>
    ${macroBar(n.protein||0, pG,  '#FF9F43', 'Белки')}
    ${macroBar(n.fat||0,     fG,  '#7C3AED', 'Жиры')}
    ${macroBar(n.carbs||0,   crbG,'#F5B942', 'Углеводы')}
  </div>`;

  const scoreColor = score >= 75 ? '#00E396' : score >= 50 ? '#F5B942' : '#FF5C8A';
  const scoreLabel = score >= 75 ? 'Отлично' : score >= 50 ? 'Норма' : score > 0 ? 'Слабо' : 'Нет данных';
  const r = 46, circ = 2*Math.PI*r, off = circ - (score/100)*circ;
  const scoreCard = `<div class="card" style="display:flex;flex-direction:column;align-items:center;text-align:center">
    <div class="sec-label" style="align-self:flex-start">🎯 БАЛЛ ПИТАНИЯ</div>
    <div style="position:relative;width:120px;height:120px;margin:6px 0 10px">
      <svg width="120" height="120">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="8"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="${scoreColor}" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 60 60)" style="filter:drop-shadow(0 0 6px ${scoreColor});transition:stroke-dashoffset .6s"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <span class="num" style="font-size:34px;font-weight:800;color:${scoreColor};line-height:1">${score}</span>
        <span style="font-size:10px;color:rgba(232,237,245,.35)">/ 100</span>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;color:${scoreColor}">● ${scoreLabel}</div>
    <button onclick="window.showNutritionScoreInfo()" style="font-size:10px;color:#00D4FF;background:none;border:none;cursor:pointer;margin-top:4px">Что это значит?</button>
  </div>`;

  // ── ЛЕНТА ПИТАНИЯ ─────────────────────────────────────────────────────────
  const sorted = [...meals].sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const feedRows = sorted.length ? sorted.map(m => {
    const mt = MEAL_TYPES[m.mealType] || { label: m.name || 'Приём пищи', icon:'🍽️', color:'#00E396' };
    const rawItems = Array.isArray(m.items) && m.items.length ? m.items : (m.name ? [m.name] : []);
    const items = rawItems.map(it => {
      if (typeof it === 'string') return it;
      const cal = it.calories ? ` <span style="color:rgba(232,237,245,.35)">— ${it.calories} ккал</span>` : '';
      return (it.name || '') + cal;
    });
    const hs = m.health_score ? `<span style="font-size:10px;color:${m.health_score>=7?'#00E396':m.health_score>=4?'#F5B942':'#FF5C8A'};margin-left:6px">❤️${m.health_score}/10</span>` : '';
    const dish = m.name && m.name !== mt.label ? `<div style="font-size:11px;color:rgba(232,237,245,.5);margin-top:1px">${m.name}</div>` : '';
    return `<div class="meal-row">
      <div class="meal-time">${m.time || ''}</div>
      <div class="meal-main">
        <div class="meal-title" style="color:${mt.color}">${mt.icon} ${mt.label}${hs}</div>
        ${dish}
        <ul class="meal-items">${items.map(it => `<li>${it}</li>`).join('')}</ul>
        ${m.note ? `<div class="meal-note">${m.note}</div>` : ''}
      </div>
      ${m.photo ? `<div class="meal-photo"><img src="${m.photo}" alt=""></div>` : ''}
      <div class="meal-macros">
        <div class="num" style="font-size:18px;color:#F5B942">${m.calories||0} <span style="font-size:11px;color:rgba(232,237,245,.4)">ккал</span></div>
        <div class="meal-macro-chips">
          <span style="color:#FF9F43">Б ${m.protein||0}</span>
          <span style="color:#7C3AED">Ж ${m.fat||0}</span>
          <span style="color:#F5B942">У ${m.carbs||0}</span>
        </div>
        ${isToday ? `<div class="row" style="gap:6px;justify-content:flex-end">
          <button class="meal-edit" onclick="window.editMealEntry('${m.id}')">✏️</button>
          <button class="meal-edit" onclick="window.saveMealToBase('${m.id}')" title="В базу блюд">⭐</button>
          <button class="meal-edit" onclick="window.deleteMealEntry('${m.id}')">🗑</button>
        </div>` : ''}
      </div>
    </div>`;
  }).join('') : `<div style="text-align:center;padding:30px 16px;color:rgba(232,237,245,.4)">
      <div style="font-size:40px;margin-bottom:8px">🍽️</div>
      <div style="font-size:13px">Сегодня пока ничего не добавлено</div>
      <div style="font-size:11px;margin-top:6px">Сфотографируй блюдо или добавь вручную</div>
    </div>`;

  // Журнал: метка выбранного дня
  const offD = window._nutDateOff || 0;
  const dayLabel = offD === 0 ? 'сегодня' : offD === 1 ? 'вчера'
    : sel.toLocaleDateString('ru-RU', { day:'numeric', month:'short', weekday:'short' });

  // База частых блюд — выбор в один тап
  const saved = DB.getSavedMeals();
  const baseCard = saved.length ? `<div class="card" style="margin-bottom:12px">
    <div class="sec-label" style="margin-bottom:10px">⚡ БАЗА БЛЮД · в один тап</div>
    <div class="cat-pills" style="gap:8px">
      ${saved.map(m => `<button class="cat-pill" onclick="window.quickAddSavedMeal('${m.id}')" oncontextmenu="event.preventDefault();window.removeSavedMeal('${m.id}')" style="--cc:${(MEAL_TYPES[m.mealType]||{}).color||'#00E396'};text-align:left">
        ${(MEAL_TYPES[m.mealType]||{}).icon||'🍽️'} ${m.name} <span style="color:rgba(232,237,245,.4)">· ${m.calories}к</span></button>`).join('')}
    </div>
    <div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:8px">Тап — добавить${isToday?'':' на выбранный день'}. Удержание/правый клик — убрать из базы.</div>
  </div>` : '';

  const feedCard = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <div class="sec-label" style="margin:0">🍱 ЛЕНТА ПИТАНИЯ</div>
      <div class="row" style="gap:6px;align-items:center">
        <button class="btn btn-ghost" style="font-size:13px;padding:5px 11px" onclick="window.nutDateShift(1)">‹</button>
        <span style="font-size:11px;color:#00E396;min-width:64px;text-align:center">${dayLabel}</span>
        <button class="btn btn-ghost" style="font-size:13px;padding:5px 11px;${offD===0?'opacity:.3;pointer-events:none':''}" onclick="window.nutDateShift(-1)">›</button>
      </div>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <button class="btn btn-ghost" style="font-size:11px;padding:7px 12px" onclick="window.openAddMealModal(false)">✏️ Вручную</button>
      <button class="btn btn-ghost" style="font-size:11px;padding:7px 12px" onclick="window.openFoodText()">🤖 Описать</button>
      <button class="btn btn-ghost" style="font-size:11px;padding:7px 12px" onclick="window.openFoodVoice()">🎙 Голос</button>
      <button class="btn btn-teal" style="font-size:11px;padding:7px 14px" onclick="window.openFoodCamera()">📷 Фото</button>
    </div>
    <div class="meal-feed">${feedRows}</div>
  </div>`;

  // Фото-CTA
  const photoCTA = `<button class="card photo-cta" onclick="window.openFoodCamera()">
    <span style="font-size:24px">📷</span>
    <div style="text-align:left">
      <div style="font-size:14px;font-weight:700;color:#00F5D4">Сфотографировать еду или загрузить фото</div>
      <div style="font-size:11px;color:rgba(232,237,245,.45);margin-top:2px">ИИ-анализ и подсчёт КБЖУ автоматически</div>
    </div>
    <span style="margin-left:auto;font-size:18px;color:rgba(232,237,245,.4)">›</span>
  </button>`;

  // ── АНАЛИТИКА ─────────────────────────────────────────────────────────────
  const period = window._nutPeriod || 7;
  const hist = DB.getNutritionHistory(period);
  const avg = (k) => hist.length ? Math.round(hist.reduce((s,d)=>s+(d[k]||0),0) / hist.length) : 0;
  const avgWater = hist.length ? (hist.reduce((s,d)=>s+(d.water||0),0)/hist.length).toFixed(1) : '0';
  const periodBtn = (d,l) => `<button onclick="window.setNutPeriod(${d})" style="padding:5px 12px;border-radius:10px;font-size:11px;cursor:pointer;border:1px solid ${period===d?'rgba(0,245,212,.4)':'rgba(255,255,255,.1)'};background:${period===d?'rgba(0,245,212,.12)':'transparent'};color:${period===d?'#00F5D4':'rgba(232,237,245,.5)'}">${l}</button>`;
  const miniChart = (title, value, unit, color, key, mul=1) => `<div style="background:var(--surface3);border:1px solid var(--border);border-radius:14px;padding:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:6px"><span style="font-size:10px;color:rgba(232,237,245,.5)">${title}</span><span style="font-size:9px;color:rgba(232,237,245,.3)">сред.</span></div>
    <div class="num" style="font-size:18px;color:${color};margin-bottom:6px">${value}<span style="font-size:10px;color:rgba(232,237,245,.35)"> ${unit}</span></div>
    ${sparkline(hist.map(d => (d[key]||0)*mul), color)}
  </div>`;
  const analyticsCard = `<div class="card">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="sec-label" style="margin:0">📊 АНАЛИТИКА</div>
      <div class="row" style="gap:6px">${periodBtn(7,'7 дней')}${periodBtn(30,'30 дней')}${periodBtn(90,'90 дней')}</div>
    </div>
    <div class="nut-analytics">
      ${miniChart('Калории', avg('calories'), 'ккал', '#F5B942', 'calories')}
      ${miniChart('Белки', avg('protein'), 'г', '#FF9F43', 'protein')}
      ${miniChart('Вода', avgWater, 'л', '#00D4FF', 'water')}
      ${miniChart('Углеводы', avg('carbs'), 'г', '#7C3AED', 'carbs')}
      ${miniChart('Жиры', avg('fat'), 'г', '#FF5C8A', 'fat')}
    </div>
  </div>`;

  // Советы
  const proteinLow = (n.protein || 0) < pG * 0.7;
  const adviceCard = `<div class="nut-advice">
    <div class="card" style="margin:0">
      <div class="sec-label">💡 СОВЕТ ДНЯ</div>
      <div style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.5">После силовой тренировки важно получить 20–40 г белка в течение 2 часов.</div>
    </div>
    <div class="card" style="margin:0">
      <div class="sec-label">🥩 БЕЛОК</div>
      <div style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.5">${proteinLow ? `Съедено <b style="color:#FF9F43">${n.protein||0}</b> из ${pG} г. Добей до нормы — творог, яйца, мясо.` : `Норма белка почти закрыта (${n.protein||0}/${pG} г) 👍`}</div>
    </div>
  </div>`;

  // Чекбоксы
  const checkboxes = `<div class="card">
    <div class="sec-label">💊 ЕЖЕДНЕВНЫЕ ЧЕКБОКСЫ</div>
    <div class="nutrition-checklist">
      ${[{key:'supplements',icon:'💊',label:'БАДы / СДВГ',xp:20},{key:'shower',icon:'🚿',label:'Контрастный душ',xp:20}].map(item=>`<div class="check-row${n[item.key]?' checked':''}" onclick="window.toggleNutritionCheck('${item.key}')">
        <div class="checkbox${n[item.key]?' checked':''}">${n[item.key]?'✓':''}</div>
        <span style="font-size:20px">${item.icon}</span>
        <span style="font-size:13px;flex:1">${item.label}</span>
        <span style="font-size:10px;color:#F5B942">+${item.xp} XP</span>
      </div>`).join('')}
    </div>
  </div>`;

  return `
    ${heroCard}
    <div class="nut-top">${waterCard}${kbjuCard}${scoreCard}</div>
    ${baseCard}
    ${feedCard}
    ${photoCTA}
    ${analyticsCard}
    ${adviceCard}
    ${checkboxes}
  `;
}

// ── RING SVG ──────────────────────────────────────────────────────────────────
function ringHTML(val, color, label, sublabel) {
  const r = 28, circ = 2 * Math.PI * r, offset = circ - (val / 100) * circ;
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
    <div style="position:relative;width:70px;height:70px">
      <svg width="70" height="70">
        <circle cx="35" cy="35" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
        <circle cx="35" cy="35" r="${r}" fill="none" stroke="${color}" stroke-width="6"
          stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 35 35)"
          style="filter:drop-shadow(0 0 4px ${color})"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
        <span class="num" style="font-size:13px;color:${color}">${label}</span>
      </div>
    </div>
    <span style="font-size:9px;color:rgba(232,237,245,.4)">${sublabel}</span>
  </div>`;
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function destroyHealthCharts() {
  [sleepChart, pulseChart, hrvChart].forEach(c => { try { c?.destroy(); } catch {} });
  sleepChart = pulseChart = hrvChart = null;
}

function mountHealthCharts() {
  const h = DB.getHealth();
  requestAnimationFrame(() => {
    const sc = document.getElementById('sleep-chart');
    if (sc) {
      sleepChart = new Chart(sc, {
        type: 'bar',
        data: {
          labels: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
          datasets: [{ data: h.weeklyData || [7.2,6.8,7.5,6.5,8,7.8,8.2],
            backgroundColor: (_,i) => i.dataIndex === 6 ? '#7B61FF' : 'rgba(123,97,255,.35)',
            borderRadius: 3, borderSkipped: false }],
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
          scales:{ x:{grid:{display:false},ticks:{color:'rgba(232,237,245,.35)',font:{size:9}}}, y:{display:false,min:4} } },
      });
    }
    const mini = (id, data, color) => {
      const ctx = document.getElementById(id);
      if (!ctx) return;
      return new Chart(ctx, {
        type:'line', data:{ labels:data.map((_,i)=>i), datasets:[{data,borderColor:color,borderWidth:1.5,fill:false,tension:.4,pointRadius:0}] },
        options:{ responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:false}} },
      });
    };
    pulseChart = mini('pulse-chart', h.pulseData || [58,62,60,55,58,56,60,62,59], '#FF4560');
    hrvChart   = mini('hrv-chart',   h.hrvData   || [52,58,55,48,45,42,50,56,60], '#00E396');
  });
}

// ── GLOBALS ───────────────────────────────────────────────────────────────────
window.switchHealthTab = function(tab) {
  healthTab = tab;
  renderHealth();
  TG.hapticSelection();
};

window.toggleGymDay = function(idx) {
  const days = DB.getGymDays();
  days[idx] = !days[idx];
  DB.set('gymDays', days);
  if (days[idx]) { onWorkoutLogged(50); }
  renderHealth('sport');
  TG.hapticImpact('medium');
};

window.openLogWorkout = function() {
  const div = document.createElement('div');
  div.id = 'workout-modal';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">💪 Записать тренировку</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      ${[{t:'Силовая',e:'🏋️'},{t:'Кардио',e:'🏃'},{t:'Плавание',e:'🏊'},{t:'Йога',e:'🧘'},{t:'Велосипед',e:'🚴'},{t:'Другое',e:'⚡'}]
      .map(w=>`<button class="quad-btn" data-wtype="${w.t}" onclick="window.selectWorkoutType(this,'${w.t}','${w.e}')" style="padding:12px 6px;font-size:16px">
        <div>${w.e}</div><div style="font-size:10px;margin-top:4px">${w.t}</div>
      </button>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <span style="font-size:12px;color:rgba(232,237,245,.5)">Длительность:</span>
      <input id="workout-dur" class="input" type="number" placeholder="60" style="width:80px">
      <span style="font-size:12px;color:rgba(232,237,245,.5)">мин</span>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('workout-modal').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitWorkout()">Записать 💪</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  window._workoutType  = 'Силовая';
  window._workoutEmoji = '🏋️';
  setTimeout(() => { document.querySelector('[data-wtype="Силовая"]')?.classList.add('active'); }, 50);
  TG.hapticImpact('light');
};

window.selectWorkoutType = function(el, type, emoji) {
  document.querySelectorAll('[data-wtype]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  window._workoutType  = type;
  window._workoutEmoji = emoji;
  TG.hapticSelection();
};

window.submitWorkout = function() {
  const dur = parseInt(document.getElementById('workout-dur')?.value || '60');
  const xp  = Math.round(dur * 1.5);
  DB.logWorkout({ type: window._workoutType, duration: dur, xp, emoji: window._workoutEmoji });
  document.getElementById('workout-modal')?.remove();
  onWorkoutLogged(xp);
  renderHealth('sport');
};

// ── ПЛАН ТРАНСФОРМАЦИИ: обработчики ──────────────────────────────────────────
window.uploadBodyPhoto = function(key) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.remove();
    if (!file) return;
    const thumb = await downscaleImage(file, 600);
    try {
      localStorage.setItem(key === 'before' ? 'lifeos_body_before' : 'lifeos_body_target', thumb || '');
      window._дбHook?.('bodyPhoto', { field: key, dataUrl: thumb || '' }); // синк во все устройства
      window.showToast?.(key === 'before' ? '📷 Фото «До» сохранено' : '🎯 Фото цели сохранено', 'success');
    } catch { window.showToast?.('Не удалось сохранить фото', 'error'); }
    renderHealth('sport');
    TG.hapticSuccess();
  });
  input.click();
};

window.togglePlanExercise = function(idx) {
  const dateKey = new Date().toISOString().split('T')[0];
  const k = 'lifeos_plan_ex_' + dateKey;
  const arr = JSON.parse(localStorage.getItem(k) || '[]');
  const pos = arr.indexOf(idx);
  if (pos === -1) arr.push(idx); else arr.splice(pos, 1);
  localStorage.setItem(k, JSON.stringify(arr));
  renderHealth('sport');
  TG.hapticImpact('light');
};

window.completeTodayWorkout = function(title, emoji) {
  // Лог тренировки + XP + отметка дня недели
  const xp = 120;
  DB.logWorkout({ type: title || 'Тренировка по плану', duration: 50, xp, emoji: emoji || '💪' });
  onWorkoutLogged(xp);
  // Отметить сегодняшний день в «неделе тренировок»
  const dow = new Date().getDay();
  const idx = dow === 0 ? 6 : dow - 1;
  const days = DB.getGymDays();
  days[idx] = true;
  DB.set('gymDays', days);
  window.showToast?.(`💪 Тренировка засчитана! +${xp} XP`, 'success');
  renderHealth('sport');
  TG.hapticSuccess();
};

window.openFullPlan = function() {
  const rows = STAGES.map((s, si) => `
    <div style="margin-bottom:18px">
      <div style="font-size:13px;font-weight:800;color:#00F5D4;margin-bottom:2px">Этап ${si+1}: ${s.name}</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:10px">Недели ${s.weeks.join('–')} · ${s.subtitle}</div>
      ${DAY_KEYS.map(k => {
        const d = s.days[k];
        if (d.rest) return `<div style="font-size:11px;color:rgba(232,237,245,.4);padding:4px 0">${DAY_LABELS[k]} · ${d.emoji} Отдых${d.note?' — '+d.note:''}</div>`;
        return `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
          <div style="font-size:12px;font-weight:700;color:${d.color};margin-bottom:4px">${DAY_LABELS[k]} · ${d.emoji} ${d.title}</div>
          ${d.exercises.map(e => `<div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(232,237,245,.6);padding:2px 0"><span>${e.n}</span><span class="num" style="color:rgba(232,237,245,.45);flex-shrink:0;margin-left:10px">${e.s}</span></div>`).join('')}
        </div>`;
      }).join('')}
    </div>`).join('');
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet" style="max-height:88vh;overflow-y:auto">
    <div class="modal-handle"></div>
    <div class="modal-title">🗓 Полный план · 10 недель</div>
    ${PLAN_GOAL.nutrition.map(n=>`<div style="display:flex;gap:8px;font-size:11px;color:rgba(232,237,245,.6);padding:3px 0"><span>${n.icon}</span><span>${n.text}</span></div>`).join('')}
    <div style="height:14px"></div>
    ${rows}
    <button class="btn btn-teal" style="width:100%;margin-top:8px" onclick="this.closest('.modal-overlay').remove()">Понял, погнали 💪</button>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
};

// Снимок воды за сегодня — чтобы аналитика показывала прошлые дни
function snapshotWater(liters) {
  const d = new Date();
  const key = 'lifeos_water_' + `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  try { localStorage.setItem(key, String(liters)); } catch {}
}

window.addWater = function(amount) {
  const n = DB.getNutrition();
  n.water = Math.max(0, Math.min(5, +(n.water + amount).toFixed(2)));
  DB.saveNutrition(n);
  snapshotWater(n.water);
  if (n.water >= 2) onNutritionUpdated(n);
  renderHealth('nutrition');
  TG.hapticImpact('light');
};

// Тап на стакан — устанавливает точное количество стаканов
window.setWaterGlasses = function(glassCount) {
  const n = DB.getNutrition();
  const newWater = +(glassCount * 0.25).toFixed(2);
  // Если тапаем на уже залитый последний стакан — убираем один
  const currentGlasses = Math.round(n.water / 0.25);
  n.water = currentGlasses === glassCount ? Math.max(0, newWater - 0.25) : newWater;
  DB.saveNutrition(n);
  snapshotWater(n.water);
  if (n.water >= 2) onNutritionUpdated(n);
  renderHealth('nutrition');
  TG.hapticImpact('light');
};

window.toggleNutritionCheck = function(key) {
  const n = DB.getNutrition();
  n[key] = !n[key];
  DB.saveNutrition(n);
  onNutritionUpdated(n);
  renderHealth('nutrition');
  TG.hapticImpact('medium');
};

window.loadHealthAI = async function() {
  const body = document.getElementById('ai-health-body');
  const btn  = document.getElementById('ai-health-btn');
  if (!body) return;

  body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 0">
    <div style="width:12px;height:12px;border-radius:50%;border:2px solid #00F5D4;border-top-color:transparent;animation:spin .8s linear infinite"></div>
    <span>Анализирую...</span>
  </div>`;
  if (btn) btn.disabled = true;

  try {
    const h = DB.getHealth();
    const p = DB.getProfile();
    // Простой RC расчёт без импорта gamification
    const sleepH = h?.sleep?.hours ?? 7.5;
    const hrv    = h?.hrv ?? 55;
    const base   = p?.hrvBaseline ?? 55;
    const rcVal  = Math.round((sleepH/8) * (hrv/Math.max(base,1)) * 100) / 100;
    const rcLabel = rcVal >= 1.1 ? '🚀 ВЫСОКИЙ' : rcVal >= 0.8 ? '⚡ НОРМА' : '🐢 БАШКА ТУПИТ';

    const res = await fetch('/api/health-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ health: h, profile: p, rc: { value: rcVal, label: rcLabel } }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const statusEmoji = { отлично:'🟢', хорошо:'🟡', норма:'🟠', тревога:'🔴' }[data.status] || '⚪';
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">${statusEmoji}</span>
        <span style="font-size:12px;font-weight:700;color:${data.color || '#00E396'}">${(data.status||'').toUpperCase()}</span>
      </div>
      <div style="font-size:11px;line-height:1.6;color:rgba(232,237,245,.75);margin-bottom:12px">${data.summary || ''}</div>
      ${(data.tips||[]).map(t => `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:6px">
        <span style="color:${data.color||'#00F5D4'};flex-shrink:0">→</span>
        <span style="font-size:10px;color:rgba(232,237,245,.55);line-height:1.5">${t}</span>
      </div>`).join('')}
      <div style="font-size:9px;color:rgba(232,237,245,.2);margin-top:8px;text-align:right">${new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'})}</div>`;
  } catch (err) {
    body.innerHTML = `<div style="color:#FF4560;font-size:11px">Ошибка: ${err.message}</div>`;
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── ДОБАВИТЬ ЕДУ: модалка (тип приёма + продукты + КБЖУ + фото) ─────────────
window.openAddMealModal = function(prefilled = null) {
  document.getElementById('meal-modal')?.remove();
  const div = document.createElement('div');
  div.id = 'meal-modal';
  div.className = 'modal-overlay';
  const p = prefilled || {};
  window._editMealId = p._editId || null;    // режим редактирования существующего приёма
  window._mealPhoto = p.photo || null;       // превью-фото для сохранения
  window._mealType  = p.mealType || autoMealType();
  window._mealHealth = p.health_score || null;
  // Базовые КБЖУ (для пересчёта порции) + множитель порции
  window._mealBase = { calories: p.calories||0, protein: p.protein||0, fat: p.fat||0, carbs: p.carbs||0 };
  window._mealQty  = 1;
  const itemsText = Array.isArray(p.items)
    ? p.items.map(it => typeof it === 'string' ? it : it.name).join('\n')
    : (p.items || p.name || '');
  const hs = p.health_score;
  const hsColor = hs >= 7 ? '#00E396' : hs >= 4 ? '#F5B942' : '#FF5C8A';
  const healthBadge = hs ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:${hsColor}14;border:1px solid ${hsColor}33;border-radius:10px">
    <span style="font-size:16px">❤️</span>
    <span style="font-size:12px;color:rgba(232,237,245,.7)">Польза блюда</span>
    <span style="margin-left:auto;font-size:14px;font-weight:800;color:${hsColor}">${hs}/10</span>
  </div>` : '';
  const portionStepper = (p.calories) ? `<div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">ПОРЦИЯ</div>
    <div class="row" style="gap:10px;align-items:center;margin-bottom:12px">
      <button class="btn btn-ghost" style="width:42px;font-size:18px;padding:6px" onclick="window._mealPortion(-0.5)">−</button>
      <span id="meal-qty" style="flex:1;text-align:center;font-size:15px;font-weight:700;color:#00F5D4">1 порция</span>
      <button class="btn btn-ghost" style="width:42px;font-size:18px;padding:6px" onclick="window._mealPortion(0.5)">+</button>
    </div>` : '';

  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">${p._editId ? '✏️ Изменить еду' : '🍽️ Добавить еду'}</div>
    ${p._loading ? `<div style="text-align:center;padding:24px;color:#00F5D4;font-size:13px">
      <div style="width:26px;height:26px;border-radius:50%;border:3px solid #00F5D4;border-top-color:transparent;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
      Анализирую фото через ИИ…
      <button class="btn btn-ghost" style="display:block;margin:14px auto 0;font-size:11px;padding:6px 16px" onclick="window._cancelFoodAnalysis()">Отмена</button>
    </div>` : `
    <div id="meal-form-body">
      ${p._error ? `<div style="color:#FF5C8A;font-size:11px;margin-bottom:12px">⚠️ ${p._error}</div>` : ''}
      ${p._confidence ? `<div style="font-size:10px;color:rgba(0,245,212,.7);margin-bottom:10px">🤖 ИИ распознал — проверь и скорректируй</div>` : ''}

      ${p.photo ? `<div style="border-radius:14px;overflow:hidden;margin-bottom:12px;max-height:160px"><img src="${p.photo}" style="width:100%;object-fit:cover;display:block"></div>` : ''}
      ${healthBadge}
      ${portionStepper}

      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">ПРИЁМ ПИЩИ</div>
      <div class="cat-pills" id="meal-type-pills" style="margin-bottom:12px">
        ${MEAL_ORDER.map(k => `<button class="cat-pill${window._mealType===k?' active':''}" data-mt="${k}" onclick="window._pickMealType('${k}')" style="--cc:${MEAL_TYPES[k].color}">${MEAL_TYPES[k].icon} ${MEAL_TYPES[k].label}</button>`).join('')}
      </div>

      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">ПРОДУКТЫ (каждый с новой строки)</div>
      <textarea id="meal-items" class="input" rows="3" placeholder="Омлет из 3 яиц&#10;Кофе&#10;Тост" style="margin-bottom:12px;resize:vertical">${itemsText}</textarea>

      <div class="grid2" style="margin-bottom:12px;gap:8px">
        <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Калории</div><input id="meal-cal" class="input" type="number" placeholder="650" value="${p.calories || ''}" style="width:100%"></div>
        <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Белки, г</div><input id="meal-pro" class="input" type="number" placeholder="42" value="${p.protein || ''}" style="width:100%"></div>
        <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Жиры, г</div><input id="meal-fat" class="input" type="number" placeholder="28" value="${p.fat || ''}" style="width:100%"></div>
        <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Углеводы, г</div><input id="meal-crb" class="input" type="number" placeholder="25" value="${p.carbs || ''}" style="width:100%"></div>
      </div>

      <input id="meal-note" class="input" placeholder="Заметка (необязательно)" value="${p.note || ''}" style="margin-bottom:14px;font-size:12px">

      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('meal-modal').remove()">Отмена</button>
        <button class="btn btn-teal" style="flex:2" onclick="window._submitMeal()">${p._editId ? 'Сохранить ✓' : 'Добавить ✓'}</button>
      </div>
    </div>`}
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
};

function autoMealType() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

window._pickMealType = function(k) {
  window._mealType = k;
  document.querySelectorAll('#meal-type-pills .cat-pill').forEach(b => b.classList.remove('active'));
  document.querySelector(`#meal-type-pills [data-mt="${k}"]`)?.classList.add('active');
  TG.hapticSelection();
};

// Пересчёт КБЖУ по множителю порции (Cal AI: − 1 +)
window._mealPortion = function(delta) {
  const q = Math.max(0.5, Math.round((window._mealQty + delta) * 2) / 2);
  window._mealQty = q;
  const b = window._mealBase || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = Math.round((v||0) * q); };
  set('meal-cal', b.calories); set('meal-pro', b.protein); set('meal-fat', b.fat); set('meal-crb', b.carbs);
  const lbl = document.getElementById('meal-qty');
  if (lbl) lbl.textContent = (q === 1 ? '1 порция' : q + (q < 1 ? ' порции' : ' порции'));
  TG.hapticSelection();
};

// Описать еду текстом → ИИ оценивает КБЖУ (без фото)
// Общий анализ еды по тексту (используют и текст, и голос) → модалка с КБЖУ
async function _analyzeFoodText(txt) {
  window.openAddMealModal({ _loading: true });
  try {
    const r = await fetch('/api/analyze-food', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: txt.trim() }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    window.openAddMealModal({
      mealType: autoMealType(),
      items: Array.isArray(data.items) && data.items.length ? data.items.map(i => i.name) : (data.name ? [data.name] : [txt.trim()]),
      calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat,
      health_score: data.health_score, note: data.note || '', _confidence: data.confidence,
    });
    TG.hapticImpact('medium');
  } catch (err) { window.openAddMealModal({ _error: err.message }); }
}

window.openFoodText = function() {
  const txt = prompt('Опиши что съел — ИИ посчитает КБЖУ:\nНапр. «тарелка борща со сметаной и 2 куска хлеба»');
  if (!txt || !txt.trim()) return;
  _analyzeFoodText(txt);
};

// 🎙 Голосовой ввод еды → транскрипция → тот же анализ КБЖУ
let _foodRec = null;
window.openFoodVoice = function() {
  document.getElementById('food-voice-modal')?.remove();
  const div = document.createElement('div');
  div.id = 'food-voice-modal';
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet" style="text-align:center">
    <div class="modal-handle"></div>
    <div class="modal-title">🎙️ Расскажи, что съел</div>
    <div id="fv-hint" style="font-size:12px;color:rgba(232,237,245,.55);margin:8px 0 18px">Нажми и говори — например «овсянка с бананом и кофе»</div>
    <button id="fv-btn" onclick="window._foodVoiceToggle()" style="width:84px;height:84px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#00E396,#00F5D4);font-size:34px;box-shadow:0 0 28px rgba(0,245,212,.4)">🎙️</button>
    <div id="fv-timer" style="font-family:'Orbitron';font-size:14px;color:#00F5D4;margin-top:12px;min-height:18px"></div>
    <button class="btn btn-ghost" style="width:100%;margin-top:18px" onclick="window._foodVoiceCancel()">Отмена</button>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) window._foodVoiceCancel(); });
  document.body.appendChild(div);
};

window._foodVoiceToggle = async function() {
  const btn = document.getElementById('fv-btn');
  const hint = document.getElementById('fv-hint');
  const timerEl = document.getElementById('fv-timer');
  // Идёт запись → стоп
  if (_foodRec?.recorder && _foodRec.recorder.state === 'recording') {
    _foodRec.recorder.stop();
    return;
  }
  // Старт записи
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    let sec = 0;
    const timer = setInterval(() => { sec++; if (timerEl) timerEl.textContent = `● запись ${sec}с`; }, 1000);
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach(t => t.stop());
      if (_foodRec?.cancelled) { _foodRec = null; return; }   // отменили — не распознаём
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (hint) hint.textContent = '⏳ Распознаю…';
      if (btn) btn.textContent = '⏳';
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
        if (!res.ok) throw new Error('Whisper не ответил');
        const { text } = await res.json();
        document.getElementById('food-voice-modal')?.remove();
        if (text && text.trim()) _analyzeFoodText(text);
        else window.showToast?.('Не расслышал — попробуй ещё раз', 'error');
      } catch (err) {
        if (hint) hint.textContent = `❌ ${err.message}`;
        if (btn) btn.textContent = '🎙️';
      }
    };
    recorder.start();
    _foodRec = { recorder, stream };
    if (btn) { btn.textContent = '⏹'; btn.style.background = 'linear-gradient(135deg,#FF4560,#FF6B6B)'; }
    if (hint) hint.textContent = 'Говори… нажми ⏹ когда закончишь';
    TG.hapticImpact('medium');
  } catch (err) {
    if (hint) hint.textContent = '❌ Нет доступа к микрофону';
  }
};

window._foodVoiceCancel = function() {
  try {
    if (_foodRec?.recorder?.state === 'recording') { _foodRec.cancelled = true; _foodRec.recorder.stop(); }
  } catch {}
  try { _foodRec?.stream?.getTracks().forEach(t => t.stop()); } catch {}
  document.getElementById('food-voice-modal')?.remove();
};

window._submitMeal = function() {
  const itemsRaw = document.getElementById('meal-items')?.value?.trim() || '';
  const items    = itemsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  const calories = parseInt(document.getElementById('meal-cal')?.value) || 0;
  const protein  = parseInt(document.getElementById('meal-pro')?.value) || 0;
  const carbs    = parseInt(document.getElementById('meal-crb')?.value) || 0;
  const fat      = parseInt(document.getElementById('meal-fat')?.value) || 0;
  const note     = document.getElementById('meal-note')?.value?.trim() || '';
  if (!items.length) { TG.hapticError(); return; }

  const данные = {
    mealType: window._mealType || 'snack',
    name: items[0],
    items, calories, protein, carbs, fat, note,
    health_score: window._mealHealth || null,
    photo: window._mealPhoto || null,
  };
  if (window._editMealId) {
    DB.editMeal(window._editMealId, данные);
  } else if (window._nutDateStr && window._nutDateStr !== todayStr()) {
    DB.addMealForDate(window._nutDateStr, данные); // задним числом на выбранный день
  } else {
    DB.addMeal(данные);
  }
  window._mealPhoto = null;
  window._mealHealth = null;
  window._editMealId = null;
  document.getElementById('meal-modal')?.remove();
  renderHealth('nutrition');
  TG.hapticSuccess();
};

// Открыть приём на редактирование (только для приёмов выбранного дня)
window.editMealEntry = function(id) {
  const m = currentDayMeals().find(x => x.id === id);
  if (!m) return;
  window.openAddMealModal({ ...m, _editId: id });
  TG.hapticImpact('light');
};

// Сохранить приём в базу частых блюд
window.saveMealToBase = function(id) {
  const m = currentDayMeals().find(x => x.id === id);
  if (!m) return;
  DB.saveSavedMeal(m);
  showToast?.('⭐ Добавлено в базу блюд', 'ok');
  TG.hapticSuccess();
};

// Быстрое добавление блюда из базы (один тап)
window.quickAddSavedMeal = function(id) {
  const sm = DB.getSavedMeals().find(m => m.id === id);
  if (!sm) return;
  const { id: _, ...meal } = sm;
  if (window._nutDateStr && window._nutDateStr !== todayStr()) DB.addMealForDate(window._nutDateStr, meal);
  else DB.addMeal(meal);
  renderHealth('nutrition');
  TG.hapticSuccess();
};
window.removeSavedMeal = function(id) {
  DB.deleteSavedMeal(id);
  renderHealth('nutrition');
  TG.hapticImpact('light');
};

window.deleteMealEntry = function(id) {
  DB.deleteMeal(id);
  renderHealth('nutrition');
  TG.hapticImpact('light');
};

window.setNutPeriod = function(days) {
  window._nutPeriod = days;
  renderHealth('nutrition');
  TG.hapticSelection();
};

// ── ЦЕЛИ КБЖУ (TDEE мини-онбординг, как Cal AI) ────────────────────────────
window.openGoalsModal = function() {
  const n = DB.getNutrition();
  const m = n.goalsMeta || {};
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'goals-modal';
  const act = m.activity || 1.375, goal = m.goal || 'maintain', sex = m.sex || 'male';
  const actOpt = (v,l) => `<option value="${v}" ${act==v?'selected':''}>${l}</option>`;
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🎯 Цели по КБЖУ</div>
    <div style="font-size:11px;color:rgba(232,237,245,.45);margin-bottom:14px">Посчитаем дневную норму калорий и макросов (формула Mifflin-St Jeor).</div>
    <div class="grid2" style="gap:8px;margin-bottom:10px">
      <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Вес, кг</div><input id="g-weight" class="input" type="number" value="${m.weight||''}" placeholder="80"></div>
      <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Рост, см</div><input id="g-height" class="input" type="number" value="${m.height||''}" placeholder="180"></div>
      <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Возраст</div><input id="g-age" class="input" type="number" value="${m.age||''}" placeholder="32"></div>
      <div><div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Пол</div>
        <select id="g-sex" class="input"><option value="male" ${sex==='male'?'selected':''}>Мужской</option><option value="female" ${sex==='female'?'selected':''}>Женский</option></select></div>
    </div>
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Активность</div>
    <select id="g-activity" class="input" style="margin-bottom:10px">
      ${actOpt(1.2,'Сидячий образ')}${actOpt(1.375,'Лёгкая (1-3 трен/нед)')}${actOpt(1.55,'Средняя (3-5)')}${actOpt(1.725,'Высокая (6-7)')}
    </select>
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">ЦЕЛЬ</div>
    <div class="cat-pills" id="goal-pills" style="margin-bottom:16px">
      ${[['lose','📉 Похудеть'],['maintain','⚖️ Держать'],['gain','📈 Набрать']].map(([k,l])=>`<button class="cat-pill${goal===k?' active':''}" data-goal="${k}" onclick="window._pickGoal('${k}')">${l}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('goals-modal').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window._saveGoals()">Рассчитать ✓</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  window._goalPick = goal;
};
window._pickGoal = function(k) {
  window._goalPick = k;
  document.querySelectorAll('#goal-pills .cat-pill').forEach(b => b.classList.toggle('active', b.dataset.goal === k));
  TG.hapticSelection();
};
window._saveGoals = function() {
  const params = {
    weight: +document.getElementById('g-weight')?.value,
    height: +document.getElementById('g-height')?.value,
    age:    +document.getElementById('g-age')?.value,
    sex:    document.getElementById('g-sex')?.value,
    activity: +document.getElementById('g-activity')?.value,
    goal:   window._goalPick || 'maintain',
  };
  const goals = DB.saveNutritionGoals(params);
  document.getElementById('goals-modal')?.remove();
  renderHealth('nutrition');
  window.showToast?.(`🎯 Цель: ${goals.caloriesGoal} ккал · Б${goals.proteinGoal}/Ж${goals.fatGoal}/У${goals.carbsGoal}`, 'success');
  TG.hapticSuccess();
};

window.showNutritionScoreInfo = function() {
  const n = DB.getNutrition();
  const setGoals = n.goalsMeta ? '' : `<div style="background:rgba(245,185,66,.1);border:1px solid rgba(245,185,66,.3);border-radius:10px;padding:10px 12px;margin-top:12px;font-size:11px;color:#F5B942">⚠️ Цели сейчас стоят по умолчанию (${n.caloriesGoal||2200} ккал). Задай свои в «⚙️ Цели» — балл станет точным.</div>`;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🎯 Как считается балл питания</div>
    <div style="font-size:12px;color:rgba(232,237,245,.7);line-height:1.7">
      Балл (0–100) показывает, насколько день близок к твоим целям:<br><br>
      • 🥩 <b>Белок</b> — 40% (самое важное)<br>
      • 🔥 <b>Калории</b> — 30%<br>
      • 💧 <b>Вода</b> — 30%<br><br>
      Считается как отношение <b>съедено / цель</b>. Перебор тоже снижает балл.<br>
      <span style="color:rgba(232,237,245,.45)">Съеденное берётся из реальных блюд в ленте, цели — из «⚙️ Цели» (расчёт по весу/росту/возрасту).</span>
    </div>
    ${setGoals}
    <button class="btn btn-teal" style="width:100%;margin-top:14px" onclick="this.closest('.modal-overlay').remove()">Понятно</button>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
};

// ── ФОТО ЕДЫ → GPT-4o Vision (со сжатием для хранения превью) ──────────────
window.openFoodCamera = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;

    window.openAddMealModal({ _loading: true });

    // Таймаут 35 сек + возможность отмены
    window._foodAbort = new AbortController();
    const timer = setTimeout(() => window._foodAbort?.abort(), 35000);

    try {
      const base64 = await fileToBase64(file);          // для отправки в ИИ
      const thumb  = await downscaleImage(file, 480);   // лёгкое превью для хранения
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        signal: window._foodAbort.signal,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      window.openAddMealModal({
        mealType: autoMealType(),
        items:    Array.isArray(data.items) && data.items.length ? data.items.map(i => i.name) : (data.name ? [data.name] : []),
        calories: data.calories, protein: data.protein, carbs: data.carbs, fat: data.fat,
        health_score: data.health_score,
        note:     data.note || '',
        photo:    thumb,
        _confidence: data.confidence,
      });
      TG.hapticImpact('medium');
    } catch (err) {
      if (err.name === 'AbortError') {
        document.getElementById('meal-modal')?.remove();
        window.showToast?.('Анализ отменён или превышено время', 'error');
      } else {
        window.openAddMealModal({ _error: err.message });
      }
    } finally {
      clearTimeout(timer);
      window._foodAbort = null;
    }
  });
  input.click();
};

// Отмена анализа фото из модалки загрузки
window._cancelFoodAnalysis = function() {
  window._foodAbort?.abort();
  document.getElementById('meal-modal')?.remove();
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:*;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Сжимаем фото в небольшой data-URL (JPEG), чтобы не забивать localStorage
function downscaleImage(file, maxSize = 480) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', 0.6)); }
        catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

window.showHealthBridge = function() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">📲 Apple Health → LIFE OS</div>
    <div style="font-size:12px;color:rgba(232,237,245,.6);line-height:1.7;margin-bottom:16px">
      Создайте iOS Shortcut с такими шагами:<br><br>
      1. Получить данные из Здоровья: Сон, ЧСС, ВСР, Шаги, Калории<br>
      2. Отправить POST-запрос на:<br>
      <code style="background:rgba(0,245,212,.08);color:#00F5D4;padding:4px 8px;border-radius:5px;font-size:11px;display:block;margin:8px 0;word-break:break-all">${window.location.origin}/health-sync</code>
      3. Добавить автоматизацию: запуск каждое утро в 07:00<br><br>
      <b style="color:#FFD700">Supabase Edge Function код доступен в README проекта.</b>
    </div>
    <button class="btn btn-teal" style="width:100%" onclick="this.closest('.modal-overlay').remove()">Понял, спасибо!</button>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
};
