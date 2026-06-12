// ── ANALYTICS SCREEN ──────────────────────────────────────────────────────────
import { DB } from '../db.js?v=30';
import { xpForLevel } from '../gamification.js?v=30';

let analyticsChart = null;

export function renderAnalytics() {
  const el = document.getElementById('content');
  el.innerHTML = buildAnalyticsHTML();
  requestAnimationFrame(() => mountAnalyticsChart());
}

function buildAnalyticsHTML() {
  const tasks   = DB.getTasks();
  const profile = DB.getProfile();
  const health  = DB.getHealth();
  const rpg     = DB.getRpgStats();

  const now       = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const doneWeek    = tasks.filter(t => t.done && !t.cancelled && t.completedAt && new Date(t.completedAt) >= weekStart);
  const totalXPWeek = doneWeek.reduce((s, t) => s + (t.xpValue || 0), 0);
  const q1Done      = doneWeek.filter(t => t.quadrant === 'do').length;
  const q2Done      = doneWeek.filter(t => t.quadrant === 'schedule').length;
  const totalActive = tasks.filter(t => !t.done && !t.cancelled).length;

  // XP по дням (7 дней назад → сегодня)
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    return d;
  });
  const xpByDay  = days.map(d => doneWeek.filter(t => new Date(t.completedAt).toDateString() === d.toDateString()).reduce((s, t) => s + (t.xpValue || 0), 0));
  const dayLabels = days.map(d => d.toLocaleDateString('ru-RU', { weekday: 'short' }));

  // Сохраняем для Chart.js ДО return
  window._analyticsData = { xpByDay, dayLabels };

  // Топ категории
  const catMap = {};
  doneWeek.forEach(t => { const c = t.cat || 'Другое'; catMap[c] = (catMap[c] || 0) + 1; });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Уровень
  const lvl    = profile.level || 1;
  const curXP  = profile.xp || 0;
  const needXP = xpForLevel(lvl);
  const xpPct  = Math.min(100, Math.round((curXP / needXP) * 100));

  // Продуктивность
  const totalTasks = tasks.filter(t => !t.cancelled).length;
  const doneTotal  = tasks.filter(t => t.done && !t.cancelled).length;
  const prodPct    = totalTasks > 0 ? Math.round((doneTotal / totalTasks) * 100) : 0;

  // RPG
  const rpgRows = [
    { label:'💪 BODY',  v: rpg.STR || 0 },
    { label:'♥️ RCVR',  v: rpg.VIT || 0 },
    { label:'🫂 PPL',   v: rpg.SOC || 0 },
    { label:'🧠 MIND',  v: rpg.WIS || 0 },
    { label:'⚡ NRG',   v: rpg.ENG || 0 },
  ];
  const rpgColor = v => v >= 70 ? '#00E396' : v >= 40 ? '#FFD700' : '#FF4560';

  const hrv      = health.hrv || 0;
  const sleepH   = health.sleep?.hours || 0;
  const restingHr = health.restingHr || 0;
  const hrvColor = hrv >= 60 ? '#00E396' : hrv >= 40 ? '#FFD700' : '#FF4560';
  const sleepColor = sleepH >= 7 ? '#00E396' : '#FF9F43';

  return `<div class="screen analytics-screen">

  <!-- Заголовок -->
  <div class="row" style="justify-content:space-between;margin-bottom:16px;align-items:flex-start">
    <div>
      <div class="num" style="font-size:15px;letter-spacing:.05em">📊 АНАЛИТИКА</div>
      <div style="font-size:10px;color:rgba(232,237,245,.35);margin-top:2px">Последние 7 дней</div>
    </div>
    <button class="an-back-btn" onclick="window._goAnalyticsBack()">← Назад</button>
  </div>

  <!-- Метрики 2×2 -->
  <div class="grid2" style="margin-bottom:10px">
    ${_sc('✅', 'Закрыто', doneWeek.length, 'задач за неделю', '#00E396')}
    ${_sc('⚡', 'Заработано', totalXPWeek, 'XP за неделю', '#00F5D4')}
    ${_sc('🎯', 'Q1 закрыто', q1Done, 'Штурм', '#FF4560')}
    ${_sc('🏔️', 'Q2 закрыто', q2Done, 'Рост', '#7B61FF')}
  </div>

  <!-- XP-диаграмма -->
  <div class="card" style="margin-bottom:10px">
    <div class="sec-label">📈 XP ПО ДНЯМ</div>
    <div style="position:relative;height:100px"><canvas id="analytics-chart"></canvas></div>
  </div>

  <!-- Прогресс уровня -->
  <div class="card" style="margin-bottom:10px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🏆 УРОВЕНЬ</div>
      <div class="level-badge">Ур.${lvl}</div>
    </div>
    <div class="row" style="gap:10px;margin-bottom:10px;align-items:center">
      <div style="flex:1">
        <div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div></div>
        <div class="row" style="justify-content:space-between;margin-top:3px">
          <span style="font-size:9px;color:rgba(232,237,245,.3)">${curXP} XP</span>
          <span style="font-size:9px;color:rgba(232,237,245,.3)">${needXP} XP</span>
        </div>
      </div>
      <div style="text-align:right">
        <div class="num" style="font-size:15px;color:#FFD700">${xpPct}%</div>
        <div style="font-size:9px;color:rgba(232,237,245,.3)">до Ур.${lvl+1}</div>
      </div>
    </div>
    <div class="row" style="justify-content:space-around">
      ${_ms('🔥', profile.streak || 0, 'Стрик', '#FF9F43')}
      ${_ms('✅', prodPct+'%', 'Закрыто', '#00E396')}
      ${_ms('📋', totalActive, 'Активных', '#00C9FF')}
    </div>
  </div>

  <!-- Топ категории -->
  ${topCats.length ? `<div class="card" style="margin-bottom:10px">
    <div class="sec-label">🏷️ ТОП КАТЕГОРИИ</div>
    ${topCats.map(([cat, cnt]) => {
      const pct = doneWeek.length > 0 ? Math.round((cnt/doneWeek.length)*100) : 0;
      return `<div style="margin-bottom:7px">
        <div class="row" style="justify-content:space-between;margin-bottom:3px">
          <span style="font-size:11px">${cat}</span>
          <span style="font-size:9px;color:rgba(232,237,245,.35)">${cnt} · ${pct}%</span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#00F5D4,#7B61FF);border-radius:2px"></div>
        </div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- RPG шкалы -->
  <div class="card" style="margin-bottom:10px">
    <div class="sec-label">🧬 ШКАЛЫ СЕЙЧАС</div>
    ${rpgRows.map(r => `<div style="margin-bottom:7px">
      <div class="row" style="justify-content:space-between;margin-bottom:2px">
        <span style="font-size:10px;color:rgba(232,237,245,.55)">${r.label}</span>
        <span style="font-size:10px;font-weight:700;font-family:Orbitron;color:${rpgColor(r.v)}">${r.v}</span>
      </div>
      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
        <div style="width:${r.v}%;height:100%;background:${rpgColor(r.v)};border-radius:2px;
                    box-shadow:0 0 5px ${rpgColor(r.v)}55;transition:width .6s ease"></div>
      </div>
    </div>`).join('')}
  </div>

  <!-- Биометрия -->
  <div class="card" style="margin-bottom:10px">
    <div class="sec-label">❤️ БИОМЕТРИЯ СЕГОДНЯ</div>
    <div class="grid3">
      ${_ms('HRV', hrv || '—', 'мс', hrvColor)}
      ${_ms('Сон', sleepH || '—', 'часов', sleepColor)}
      ${_ms('Пульс', restingHr || '—', 'уд/мин', '#00C9FF')}
    </div>
  </div>

  <div style="height:16px"></div>
</div>`;
}

// stat card 2×2
function _sc(icon, label, value, sub, color) {
  return `<div class="card" style="margin:0;padding:12px 10px">
    <div style="font-size:16px;margin-bottom:3px">${icon}</div>
    <div class="num" style="font-size:19px;color:${color};line-height:1.1">${value}</div>
    <div style="font-size:10px;color:rgba(232,237,245,.5);margin-top:2px">${label}</div>
    <div style="font-size:8px;color:rgba(232,237,245,.25)">${sub}</div>
  </div>`;
}

// mini stat
function _ms(label, value, sub, color) {
  return `<div style="text-align:center">
    <div class="num" style="font-size:14px;color:${color}">${value}</div>
    <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:1px">${label}</div>
    ${sub ? `<div style="font-size:8px;color:rgba(232,237,245,.2)">${sub}</div>` : ''}
  </div>`;
}

function mountAnalyticsChart() {
  const canvas = document.getElementById('analytics-chart');
  if (!canvas || !window._analyticsData) return;
  if (analyticsChart) { analyticsChart.destroy(); analyticsChart = null; }

  const { xpByDay, dayLabels } = window._analyticsData;

  analyticsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        data: xpByDay,
        backgroundColor: xpByDay.map((_, i) => i === 6 ? 'rgba(0,245,212,.7)' : 'rgba(123,97,255,.4)'),
        borderColor:     xpByDay.map((_, i) => i === 6 ? '#00F5D4' : '#7B61FF'),
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `+${ctx.raw} XP` } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(232,237,245,.3)', font: { size: 9 } }
        },
        y: { display: false, beginAtZero: true }
      }
    }
  });
}
