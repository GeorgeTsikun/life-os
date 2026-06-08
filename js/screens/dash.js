// ── DASHBOARD SCREEN ──────────────────────────────────────────────────────────
import { DB } from '../db.js';
import { levelFromXp, xpProgress, xpForLevel, RPG_STATS, onQuestCompleted } from '../gamification.js';
import { TG } from '../telegram.js';

let radarChart, energyChart;

export function renderDash() {
  const profile = DB.getProfile();
  const health  = DB.getHealth();
  const tasks   = DB.getTasks();
  const quests  = DB.getQuests();
  const achs    = DB.getAchievements();
  const rpg     = DB.getRpgStats();
  const daily   = DB.getDailyLog();

  const level   = levelFromXp(profile.xp || 0);
  const prog    = xpProgress(profile.xp || 0);
  const needXp  = xpForLevel(level);
  const curXp   = Math.round(prog * needXp);
  const mult    = profile.streak >= 7 ? '1.1x' : profile.streak >= 14 ? '1.25x' : profile.streak >= 30 ? '1.5x' : '';
  const doneTasks = tasks.filter(t=>t.done).length;
  const unlockedAchs = achs.filter(a=>a.unlocked);

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">

  <div class="dash-header">
    <div>
      <div class="row" style="gap:8px;margin-bottom:3px">
        <span class="num dash-name">${profile.name}</span>
        <span style="font-size:20px">${profile.avatar || '👑'}</span>
      </div>
      <div class="dash-tagline">${profile.tagline || 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР'}</div>
    </div>
    <div style="text-align:right">
      <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-bottom:6px">
        <span class="level-badge">УР. ${level}</span>
        <button onclick="window.goTab(null,'achievements')" style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:7px;padding:3px 8px;cursor:pointer;font-size:14px" title="Достижения">🏆</button>
      </div>
      <div class="streak-badge">
        <span class="flame" style="font-size:14px">🔥</span>
        <span class="num" style="color:#FFD700;font-size:14px">${profile.streak || 1}</span>
        <span style="font-size:10px;color:rgba(232,237,245,.4)">страйк${mult ? ' · ' + mult : ''}</span>
      </div>
    </div>
  </div>

  <div style="margin-bottom:14px">
    <div class="row" style="justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;color:rgba(232,237,245,.4)">Опыт · Ур.${level}</span>
      <span class="num" style="font-size:11px;color:#00F5D4">${curXp.toLocaleString()} / ${needXp.toLocaleString()} XP</span>
    </div>
    <div class="xp-bar"><div class="xp-fill" style="width:${(prog*100).toFixed(1)}%"></div></div>
    <div style="text-align:right;font-size:10px;color:rgba(232,237,245,.3);margin-top:3px">+${(needXp-curXp).toLocaleString()} до Уровня ${level+1}</div>
  </div>

  <div class="energy-chips">
    ${[
      {l:'Сон',v:health.sleep?.hours+'ч',i:'🌙',c:'#7B61FF'},
      {l:'Энергия',v:(daily.energy||7)+'/10',i:'⚡',c:'#FFD700'},
      {l:'Задачи',v:`${doneTasks}/${tasks.length}`,i:'✅',c:'#00F5D4'},
      {l:'Фокус',v:(daily.focus||2.5)+'ч',i:'🎯',c:'#00E396'},
    ].map(s=>`<div class="stat-chip">
      <div style="font-size:18px;margin-bottom:4px">${s.i}</div>
      <div class="num" style="font-size:13px;color:${s.c}">${s.v}</div>
      <div style="font-size:9px;color:rgba(232,237,245,.4);margin-top:2px">${s.l}</div>
    </div>`).join('')}
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">⚡ КВЕСТЫ ДНЯ</div>
    <div class="quests-grid">
      ${quests.map(q=>`<div class="quest-card${q.done?' done':''}" onclick="window.completeQuest('${q.id}')">
        <div class="quest-icon">${q.icon}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;text-decoration:${q.done?'line-through':'none'};color:${q.done?'rgba(232,237,245,.4)':'#E8EDF5'}">${q.title}</div>
          <div style="font-size:10px;color:rgba(0,245,212,.7);margin-top:2px">+${q.xp} XP</div>
        </div>
        <div style="font-size:16px">${q.done?'✅':'⬜'}</div>
      </div>`).join('')}
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">📊 СОСТОЯНИЕ ГЕРОЯ</div>
    <div class="grid2">
      <canvas id="radar-chart" style="max-height:155px"></canvas>
      <div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Энергия / неделя</div>
        <canvas id="energy-chart" style="max-height:145px"></canvas>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🎯 ФОКУС ДНЯ</div>
      <span class="badge" style="background:rgba(255,215,0,.12);color:#FFD700;border:1px solid rgba(255,215,0,.2)">Сегодня</span>
    </div>
    ${tasks.filter(t=>t.quadrant==='do'&&!t.done).slice(0,3).map((t,i)=>`
    <div class="focus-item" style="${i<2?'border-bottom:1px solid rgba(255,255,255,.05)':''}">
      <div class="focus-num" style="background:${i===0?'rgba(0,245,212,.15)':'rgba(255,255,255,.06)'};color:${i===0?'#00F5D4':'rgba(232,237,245,.5)'};border:1px solid ${i===0?'rgba(0,245,212,.3)':'rgba(255,255,255,.08)'}">${i+1}</div>
      <div style="flex:1;padding:0 8px">
        <div style="font-size:13px;font-weight:500">${t.text}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${t.cat}</div>
      </div>
      <div style="font-size:10px;color:rgba(232,237,245,.4)">${t.time}</div>
    </div>`).join('') || `<div style="text-align:center;padding:12px 0;font-size:12px;color:rgba(232,237,245,.35)">✓ Все срочные задачи выполнены!</div>`}
  </div>

  <div style="font-size:11px;color:rgba(232,237,245,.4);letter-spacing:.05em;margin-bottom:8px">🏆 ДОСТИЖЕНИЯ</div>
  <div class="grid2" style="margin-bottom:12px">
    ${unlockedAchs.slice(0,4).map(a=>`
    <div style="background:${a.color}08;border:1px solid ${a.color}22;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">${a.icon}</span>
      <div>
        <div style="font-size:11px;font-weight:600;color:${a.color}">${a.name}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:1px">✓ Получено</div>
      </div>
    </div>`).join('')}
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">🧬 RPG ХАРАКТЕРИСТИКИ</div>
    ${RPG_STATS.map(s=>`<div class="stat-row">
      <div class="stat-label" style="color:${s.color}">${s.label}</div>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${rpg[s.key]}%;background:${s.color};box-shadow:0 0 6px ${s.color}60"></div></div>
      <div class="stat-val" style="color:${s.color}">${rpg[s.key]}</div>
    </div>`).join('')}
  </div>

  <div style="height:12px"></div>
</div>`;

  // Mount charts
  requestAnimationFrame(() => {
    destroyCharts();
    mountRadar(rpg);
    mountEnergy(health.energyData || [65,72,88,75,91,60,55]);
  });

  // Telegram
  TG.hideMainButton();
  TG.hideBackButton();
}

function destroyCharts() {
  if (radarChart)  { try { radarChart.destroy();  } catch {} radarChart  = null; }
  if (energyChart) { try { energyChart.destroy(); } catch {} energyChart = null; }
}

function mountRadar(rpg) {
  const ctx = document.getElementById('radar-chart');
  if (!ctx) return;
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['СИЛ','ВИТ','ИНТ','ХАР','МУД','ФОК'],
      datasets: [{
        data: [rpg.STR,rpg.VIT,rpg.INT,rpg.CHA,rpg.WIS,rpg.FOC],
        backgroundColor: 'rgba(0,245,212,.12)',
        borderColor: '#00F5D4',
        borderWidth: 1.5,
        pointBackgroundColor: '#00F5D4',
        pointRadius: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 100,
          grid:   { color: 'rgba(255,255,255,.07)' },
          angleLines: { color: 'rgba(255,255,255,.07)' },
          pointLabels: { color: 'rgba(232,237,245,.45)', font: { size: 9, family: 'Manrope' } },
          ticks: { display: false },
        },
      },
    },
  });
}

function mountEnergy(data) {
  const ctx = document.getElementById('energy-chart');
  if (!ctx) return;
  energyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
      datasets: [{
        data,
        borderColor: '#00F5D4',
        borderWidth: 2,
        backgroundColor: 'rgba(0,245,212,.12)',
        fill: true,
        tension: .4,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(232,237,245,.35)', font: { size: 9 } } },
        y: { display: false, min: 30 },
      },
    },
  });
}
