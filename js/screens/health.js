// ── HEALTH SCREEN (Health / Sport / Nutrition sub-tabs) ───────────────────────
import { DB } from '../db.js';
import { onWorkoutLogged, onNutritionUpdated } from '../gamification.js';
import { TG } from '../telegram.js';

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
function sportTabHTML() {
  const workouts = DB.getWorkouts();
  const gymDays  = DB.getGymDays();
  const days     = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const today    = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;
  const monthCount = workouts.filter(w => {
    const d = new Date(w.date);
    return d.getMonth() === new Date().getMonth();
  }).length;

  return `
  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">💪 НЕДЕЛЯ ТРЕНИРОВОК</div>
    <div class="row" style="gap:6px">
      ${gymDays.map((done,i)=>`<div class="day-dot">
        <div class="day-circle${done?' done':''}${i===todayIdx?' today':''}" onclick="window.toggleGymDay(${i})">
          ${done?'💪':''}
        </div>
        <span style="font-size:9px;color:rgba(232,237,245,.35)">${days[i]}</span>
      </div>`).join('')}
    </div>
    <div style="margin-top:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:5px">
        <span style="font-size:11px;color:rgba(232,237,245,.4)">Месяц: ${monthCount} тренировок</span>
        <span style="font-size:11px;color:#00F5D4">цель 16</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${Math.min((monthCount/16)*100,100)}%;background:#00F5D4;box-shadow:0 0 6px rgba(0,245,212,.4)"></div></div>
    </div>
  </div>

  <button class="btn btn-teal" style="width:100%;margin-bottom:12px;padding:12px" onclick="window.openLogWorkout()">
    + Записать тренировку
  </button>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">📋 ПОСЛЕДНИЕ ТРЕНИРОВКИ</div>
    ${workouts.slice(0,5).map(w=>`<div class="workout-item">
      <div class="workout-type-icon">${w.emoji||'🏋️'}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${w.type}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4)">${w.date}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#00F5D4">${w.duration} мин</div>
        <div style="font-size:10px;color:#FFD700">+${w.xp} XP</div>
      </div>
    </div>`).join('')}
    ${workouts.length === 0 ? '<div style="text-align:center;padding:12px 0;font-size:12px;color:rgba(232,237,245,.3)">Нет тренировок. Начни прямо сейчас!</div>' : ''}
  </div>`;
}

// ── NUTRITION TAB ─────────────────────────────────────────────────────────────
function nutritionTabHTML() {
  const n = DB.getNutrition();
  const waterPct = Math.min((n.water / n.waterGoal) * 100, 100);

  return `
  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">💧 ВОДА</div>
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
      <div>
        <div class="num" style="font-size:28px;color:#00C9FF">${n.water}л</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4)">цель ${n.waterGoal}л</div>
      </div>
      <div style="position:relative;width:70px;height:70px">
        <svg width="70" height="70">
          <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="6"/>
          <circle cx="35" cy="35" r="28" fill="none" stroke="#00C9FF" stroke-width="6"
            stroke-dasharray="${(2*Math.PI*28).toFixed(1)}" stroke-dashoffset="${((1-waterPct/100)*2*Math.PI*28).toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 35 35)"
            style="filter:drop-shadow(0 0 4px #00C9FF)"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
          <span style="font-size:14px;font-weight:700;color:#00C9FF">${Math.round(waterPct)}%</span>
        </div>
      </div>
    </div>
    <div class="row" style="gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="window.addWater(-0.25)">-250мл</button>
      <button class="btn btn-teal"  style="flex:1" onclick="window.addWater(0.25)">+250мл 💧</button>
      <button class="btn btn-ghost" style="flex:1" onclick="window.addWater(0.5)">+500мл</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="sec-label" style="margin:0">🥗 ПИТАНИЕ</div>
      <div class="num" style="font-size:20px;color:#00E396">${n.score}/10</div>
    </div>
    <div class="prog-bar" style="height:8px;margin-bottom:12px">
      <div class="prog-fill" style="width:${n.score*10}%;background:#00E396;box-shadow:0 0 6px rgba(0,227,150,.4)"></div>
    </div>
    <div class="grid3">
      ${[
        {l:'Белок',v:n.protein+'г',c:'#FF9F43'},
        {l:'Углев.',v:n.carbs+'г',c:'#7B61FF'},
        {l:'Жиры',v:n.fat+'г',c:'#FFD700'},
      ].map(m=>`<div style="text-align:center">
        <div style="font-size:13px;font-weight:700;color:${m.c}">${m.v}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.35)">${m.l}</div>
      </div>`).join('')}
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">💊 ЕЖЕДНЕВНЫЕ ЧЕКБОКСЫ</div>
    <div class="nutrition-checklist">
      ${[
        {key:'supplements',icon:'💊',label:'БАДы / СДВГ',xp:20},
        {key:'shower',     icon:'🚿',label:'Контрастный душ',xp:20},
      ].map(item=>`<div class="check-row${n[item.key]?' checked':''}" onclick="window.toggleNutritionCheck('${item.key}')">
        <div class="checkbox${n[item.key]?' checked':''}">
          ${n[item.key]?'✓':''}
        </div>
        <span style="font-size:20px">${item.icon}</span>
        <span style="font-size:13px;flex:1">${item.label}</span>
        <span style="font-size:10px;color:#FFD700">+${item.xp} XP</span>
      </div>`).join('')}
    </div>
  </div>`;
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

window.addWater = function(amount) {
  const n = DB.getNutrition();
  n.water = Math.max(0, Math.min(5, +(n.water + amount).toFixed(2)));
  DB.saveNutrition(n);
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
