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
  const coins = profile.coins || 0;
  const photoSrc = profile.photo || 'assets/avatar.jpg';
  const liveQuests = quests.filter(q => !q.done);

  el.innerHTML = `<div class="screen">

  <!-- ── ГЕРОЙ-КАРТА с фото ────────────────────────────────────────────────── -->
  <div class="hero-card" style="position:relative;border-radius:18px;overflow:hidden;margin-bottom:14px;background:linear-gradient(135deg,#0a1628,#03030A);border:1px solid rgba(0,245,212,.15)">
    <div style="position:relative;aspect-ratio:16/10;overflow:hidden">
      <img src="${photoSrc}"
           alt="${profile.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           style="width:100%;height:100%;object-fit:cover;display:block">
      <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a1628,#1a0a2e);font-size:80px">${profile.avatar || '🦈'}</div>
      <!-- Градиент-затемнение снизу для читаемости текста -->
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(3,3,10,.85) 100%);pointer-events:none"></div>
      <!-- Имя + слоган поверх фото -->
      <div style="position:absolute;left:16px;right:16px;bottom:14px">
        <div class="num" style="font-size:26px;font-weight:800;letter-spacing:.04em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)">${profile.name}</div>
        <div style="font-size:10px;letter-spacing:.12em;color:rgba(232,237,245,.7);margin-top:2px">${profile.tagline || 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР'}</div>
      </div>
      <!-- Уровень верх-право -->
      <div style="position:absolute;top:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="level-badge" style="background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(0,245,212,.3);color:#00F5D4;font-weight:800">УР. ${level}</span>
        <div class="streak-badge" style="background:rgba(0,0,0,.55);backdrop-filter:blur(8px)">
          <span class="flame" style="font-size:13px">🔥</span>
          <span class="num" style="color:#FFD700;font-size:13px">${profile.streak || 1}</span>
          <span style="font-size:9px;color:rgba(232,237,245,.6)">страйк${mult ? ' · ' + mult : ''}</span>
        </div>
      </div>
    </div>
    <!-- Прогресс-полоса XP внизу карты -->
    <div style="padding:12px 16px">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <span style="font-size:10px;color:rgba(232,237,245,.5);letter-spacing:.08em">ОПЫТ · УР.${level}</span>
        <span class="num" style="font-size:11px;color:#00F5D4">${curXp.toLocaleString()} / ${needXp.toLocaleString()}</span>
      </div>
      <div class="xp-bar"><div class="xp-fill" style="width:${(prog*100).toFixed(1)}%"></div></div>
      <!-- Двойной счёт: накопленный XP (уровень) + монеты (трачимый баланс) -->
      <div class="row" style="justify-content:space-between;margin-top:10px;gap:10px">
        <div class="row" style="gap:6px;background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:10px;padding:7px 10px;flex:1">
          <span style="font-size:14px">⭐</span>
          <div style="line-height:1.1">
            <div class="num" style="font-size:13px;color:#00F5D4">${curXp.toLocaleString()}</div>
            <div style="font-size:8px;color:rgba(232,237,245,.4);letter-spacing:.06em">XP до Ур.${level+1}</div>
          </div>
        </div>
        <button onclick="window.openCoinsSpend?.()" style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);border-radius:10px;padding:7px 10px;flex:1;cursor:pointer;display:flex;align-items:center;gap:6px">
          <span style="font-size:14px">💰</span>
          <div style="line-height:1.1;text-align:left">
            <div class="num" style="font-size:13px;color:#FFD700">${coins.toLocaleString()}</div>
            <div style="font-size:8px;color:rgba(232,237,245,.4);letter-spacing:.06em">МОНЕТ · ТРАТИТЬ</div>
          </div>
        </button>
        <button onclick="window.goTab(null,'achievements')" style="background:rgba(123,97,255,.08);border:1px solid rgba(123,97,255,.25);border-radius:10px;padding:7px 10px;cursor:pointer;font-size:16px" title="Достижения">🏆</button>
      </div>
    </div>
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
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">⚡ КВЕСТЫ ДНЯ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${liveQuests.length} активных · ${quests.length - liveQuests.length} ✓</span>
    </div>
    ${liveQuests.length > 0 ? `<div class="quests-grid">
      ${liveQuests.map(q=>`<div class="quest-card" onclick="window.completeQuest('${q.id}')">
        <div class="quest-icon">${q.icon}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:#E8EDF5">${q.title}</div>
          <div style="font-size:10px;color:rgba(0,245,212,.7);margin-top:2px">+${q.xp} XP · +${q.xp} 💰</div>
        </div>
        <div style="font-size:16px">⬜</div>
      </div>`).join('')}
    </div>` : `<div style="text-align:center;padding:18px 8px">
      <div style="font-size:32px;margin-bottom:6px">🎯</div>
      <div style="font-size:13px;font-weight:600;color:#00F5D4;margin-bottom:4px">Все квесты сегодня выполнены!</div>
      <div style="font-size:11px;color:rgba(232,237,245,.4)">Новые появятся завтра в 08:00</div>
    </div>`}
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

// ── ТРАТА МОНЕТ — мини-модал ─────────────────────────────────────────────────
window.openCoinsSpend = function() {
  const p = DB.getProfile();
  const coins = p.coins || 0;
  const опции = [
    { сумма: 50,  иконка: '📱', что: 'Соцсети 15 мин' },
    { сумма: 100, иконка: '🎮', что: 'Игры 30 мин' },
    { сумма: 150, иконка: '📺', que: 'YouTube/сериал 45 мин' },
    { сумма: 200, иконка: '🍔', что: 'Доставка/вкусняшка' },
    { сумма: 300, иконка: '🎬', что: 'Кино/выход в свет' },
  ];
  const div = document.createElement('div');
  div.id = 'coins-spend-modal';
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <div style="font-size:14px;font-weight:700">💰 Потратить монеты</div>
      <button onclick="document.getElementById('coins-spend-modal')?.remove()" style="background:none;border:none;color:rgba(232,237,245,.5);font-size:20px;cursor:pointer">×</button>
    </div>
    <div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:14px;margin-bottom:14px;text-align:center">
      <div style="font-size:10px;color:rgba(232,237,245,.5);letter-spacing:.08em;margin-bottom:4px">БАЛАНС</div>
      <div class="num" style="font-size:28px;color:#FFD700;font-weight:800">${coins.toLocaleString()} 💰</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:4px">потрачено всего: ${(p.coinsSpent||0).toLocaleString()}</div>
    </div>
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:8px;letter-spacing:.08em">НА ЧТО ПОТРАТИТЬ</div>
    ${опции.map(o => `<button onclick="window.coinsBuy(${o.сумма}, '${o.что}')" ${coins < o.сумма ? 'disabled' : ''}
      style="width:100%;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;margin-bottom:6px;cursor:pointer;${coins < o.сумма ? 'opacity:.35' : ''}">
      <span style="font-size:22px">${o.иконка}</span>
      <div style="flex:1;text-align:left">
        <div style="font-size:13px;font-weight:600;color:#E8EDF5">${o.что || o.que}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4)">${coins < o.сумма ? 'Не хватает ' + (o.сумма - coins) + ' 💰' : 'Заработай ещё чуть-чуть → разблокируется'}</div>
      </div>
      <div class="num" style="font-size:14px;color:#FFD700">${o.сумма} 💰</div>
    </button>`).join('')}
    <div style="font-size:10px;color:rgba(232,237,245,.3);text-align:center;margin-top:10px;line-height:1.5">
      Заработай монеты выполнением задач.<br>Трать на отдых без вины — ты честно заслужил.
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  TG.hapticImpact('light');
};

window.coinsBuy = function(сумма, что) {
  const р = DB.потратитьМонеты(сумма, что);
  if (!р.ok) { window.showToast?.('Не хватает монет', 'error'); return; }
  document.getElementById('coins-spend-modal')?.remove();
  window.showToast?.(`✓ ${что} · −${сумма} 💰 · осталось ${р.balance}`, 'success');
  TG.hapticSuccess();
  // Перерисовать дашборд чтобы баланс обновился
  if (document.querySelector('.dash-header, .hero-card')) renderDash();
};

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
