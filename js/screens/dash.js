// ── DASHBOARD SCREEN ──────────────────────────────────────────────────────────
import { DB } from '../db.js?v=45';
import { levelFromXp, xpProgress, xpForLevel, RPG_STATS, onQuestCompleted, calcRC, rcMode, awardXP } from '../gamification.js?v=45';
import { TG } from '../telegram.js?v=45';

let radarChart, energyChart;
let _currentQuests = []; // для синхронизации taskId при completeQuest
let focusFilter = 'all'; // 'all' | 'work' | 'personal' | 'cat:X'

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
  const mult    = profile.streak >= 30 ? '1.5x' : profile.streak >= 14 ? '1.25x' : profile.streak >= 7 ? '1.1x' : '';
  const doneTasks = tasks.filter(t => t.done).length;
  const unlockedAchs = achs.filter(a => a.unlocked);

  const photoSrc  = profile.photo || 'assets/avatar.jpg';
  // Квесты дня — самостоятельные ежедневные привычки (НЕ подменяем на задачи,
  // иначе задача дублируется и в «Квестах», и в «Фокусе»). Задачи живут в Фокусе.
  const динамичныеКвесты = DB.getQuests();
  _currentQuests = динамичныеКвесты; // сохраняем для completeQuest
  const liveQuests = динамичныеКвесты.filter(q => !q.done);
  const doneQuests = динамичныеКвесты.filter(q => q.done);

  // Дофамин-баланс (механика GAMECHANGER)
  const earned     = DB.getEarned();
  const spent      = DB.getSpent();
  const balance    = DB.getBalance();
  const ratio      = DB.getPleasureRatio();
  const todayStats = DB.getTodayStats();

  const el = document.getElementById('content');
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

  if (isDesktop) {
    el.innerHTML = десктопныйДашборд({
      profile, health, tasks, daily, rpg, level, prog, needXp, curXp, mult,
      doneTasks, динамичныеКвесты, liveQuests, doneQuests,
      earned, spent, balance, ratio, todayStats, unlockedAchs, photoSrc,
    });
  } else {
  el.innerHTML = `<div class="screen">

  <!-- ── ГЕРОЙ-КАРТА с фото ────────────────────────────────────────────────── -->
  <div class="hero-card" style="position:relative;border-radius:18px;overflow:hidden;margin-bottom:14px;background:linear-gradient(135deg,#0a1628,#03030A);border:1px solid rgba(0,245,212,.15)">
    <div style="position:relative;aspect-ratio:16/10;overflow:hidden">
      <img src="${photoSrc}"
           alt="${profile.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           style="width:100%;height:100%;object-fit:cover;display:block">
      <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a1628,#1a0a2e);font-size:80px">${profile.avatar || '🦈'}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(3,3,10,.85) 100%);pointer-events:none"></div>
      <div style="position:absolute;left:16px;right:16px;bottom:14px">
        <div class="num" style="font-size:26px;font-weight:800;letter-spacing:.04em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.6)">${profile.name}</div>
        <div style="font-size:10px;letter-spacing:.12em;color:rgba(232,237,245,.7);margin-top:2px">${profile.tagline || 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР'}</div>
      </div>
      <div style="position:absolute;top:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="window._openAnalytics()" title="Аналитика"
            style="padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.2);
                   background:rgba(0,0,0,.55);backdrop-filter:blur(8px);
                   color:#E8EDF5;font-size:11px;cursor:pointer;line-height:1">📊</button>
          <span class="level-badge" style="background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(0,245,212,.3);color:#00F5D4;font-weight:800">УР. ${level}</span>
        </div>
        <div class="streak-badge" style="background:rgba(0,0,0,.55);backdrop-filter:blur(8px)">
          <span class="flame" style="font-size:13px">🔥</span>
          <span class="num" style="color:#FFD700;font-size:13px">${profile.streak || 1}</span>
          <span style="font-size:9px;color:rgba(232,237,245,.6)">страйк${mult ? ' · ' + mult : ''}</span>
        </div>
      </div>
    </div>

    <!-- XP + Дофамин-баланс -->
    <div style="padding:12px 16px">
      <div class="row" style="justify-content:space-between;margin-bottom:5px">
        <span style="font-size:10px;color:rgba(232,237,245,.5);letter-spacing:.08em">XP · УР.${level}</span>
        <span class="num" style="font-size:10px;color:#00F5D4">${curXp.toLocaleString()} / ${needXp.toLocaleString()}</span>
      </div>
      <div class="xp-bar" style="margin-bottom:12px"><div class="xp-fill" style="width:${(prog * 100).toFixed(1)}%"></div></div>
      ${renderBalanceBlock(balance, earned, spent, ratio, todayStats)}
    </div>
  </div>

  <!-- ── СФЕРА-АВАТАР ─────────────────────────────────────────────────────────── -->
  ${renderSphere(health, profile, tasks)}

  <!-- ── МИНИ-СТАТЫ ──────────────────────────────────────────────────────────── -->
  <div class="energy-chips">
    ${[
      { l:'Сон',    v: health.sleep?.hours + 'ч', i:'🌙', c:'#7B61FF' },
      { l:'Энергия',v: (daily.energy || 7) + '/10', i:'⚡', c:'#FFD700' },
      { l:'Задачи', v: `${doneTasks}/${tasks.filter(t => !t.done || t.done).length}`, i:'✅', c:'#00F5D4' },
      { l:'Фокус',  v: (daily.focus || 2.5) + 'ч', i:'🎯', c:'#00E396' },
    ].map(s => `<div class="stat-chip">
      <div style="font-size:18px;margin-bottom:4px">${s.i}</div>
      <div class="num" style="font-size:13px;color:${s.c}">${s.v}</div>
      <div style="font-size:9px;color:rgba(232,237,245,.4);margin-top:2px">${s.l}</div>
    </div>`).join('')}
  </div>

  <!-- ── REAL CAPACITY ────────────────────────────────────────────────────────── -->
  ${renderRcBlock(health, profile)}

  <!-- ── DAILY CHECK-IN ────────────────────────────────────────────────────────── -->
  ${renderCheckinBlock(daily)}

  <!-- ── Q1 ЛИМИТ ──────────────────────────────────────────────────────────────── -->
  ${renderQ1Alert(tasks)}

  <!-- ── КВЕСТЫ ДНЯ ─────────────────────────────────────────────────────────── -->
  <div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">⚡ КВЕСТЫ ДНЯ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${liveQuests.length} активных · ${doneQuests.length} ✓</span>
    </div>
    ${динамичныеКвесты.map(q => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer"
           onclick="window.${q.done ? 'resetQuest' : 'completeQuest'}('${q.id}')">
        <div style="width:28px;height:28px;border-radius:8px;background:${q.done ? 'rgba(0,245,212,.15)' : 'rgba(255,255,255,.05)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${q.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${q.done ? 'rgba(232,237,245,.35)' : '#E8EDF5'};${q.done ? 'text-decoration:line-through' : ''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.title}</div>
          <div style="font-size:9px;color:rgba(0,245,212,.6);margin-top:1px">${q.done ? '✓ выполнено · нажми чтобы отменить' : '+' + q.xp + ' XP'}</div>
        </div>
        <div style="font-size:18px;flex-shrink:0">${q.done ? '✅' : '⬜'}</div>
      </div>`).join('')}
  </div>

  <!-- ── РАСПИСАНИЕ ДНЯ (таймлайн) ─────────────────────────────────────────── -->
  ${renderTimelineBlock(tasks)}

  <!-- ── ФОКУС ДНЯ ──────────────────────────────────────────────────────────── -->
  ${renderFocusBlock(tasks, health, profile)}

  <!-- ── ЖУРНАЛ / ИНБОКС ───────────────────────────────────────────────────────── -->
  ${renderInboxBlock()}

  <!-- ── ДОСТИЖЕНИЯ ─────────────────────────────────────────────────────────── -->
  ${unlockedAchs.length > 0 ? `
  <div style="font-size:11px;color:rgba(232,237,245,.4);letter-spacing:.05em;margin-bottom:8px">🏆 ДОСТИЖЕНИЯ</div>
  <div class="grid2" style="margin-bottom:12px">
    ${unlockedAchs.slice(0, 4).map(a => `
    <div style="background:${a.color}08;border:1px solid ${a.color}22;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:20px">${a.icon}</span>
      <div>
        <div style="font-size:11px;font-weight:600;color:${a.color}">${a.name}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:1px">✓ Получено</div>
      </div>
    </div>`).join('')}
  </div>` : ''}

  <!-- ── RPG ХАРАКТЕРИСТИКИ ─────────────────────────────────────────────────── -->
  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">📊 СОСТОЯНИЕ ГЕРОЯ</div>
    <!-- Радар — на всю ширину, достаточно крупный -->
    <div style="width:100%;height:220px;position:relative">
      <canvas id="radar-chart" style="width:100%;height:100%"></canvas>
    </div>
    <!-- Шкалы под радаром -->
    <div style="margin-top:14px">
      ${RPG_STATS.map(s => {
        const val = typeof rpg[s.key] === 'number' ? rpg[s.key] : 50;
        return `<div class="stat-row" style="margin-bottom:6px">
          <div class="stat-label" style="color:${s.color};font-size:10px;min-width:64px">${s.label}</div>
          <div class="stat-bar" style="flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;margin:0 8px">
            <div class="stat-bar-fill" style="height:100%;width:${val}%;background:${s.color};box-shadow:0 0 6px ${s.color}60;border-radius:4px;transition:width .4s ease"></div>
          </div>
          <div class="stat-val" style="color:${s.color};font-size:11px;font-weight:700;min-width:24px;text-align:right">${val}</div>
        </div>`;
      }).join('')}
    </div>
    <!-- График энергии / неделя -->
    <div style="margin-top:14px">
      <div style="font-size:9px;color:rgba(232,237,245,.35);letter-spacing:.08em;margin-bottom:6px">⚡ ЭНЕРГИЯ / НЕДЕЛЯ</div>
      <div style="height:70px;position:relative">
        <canvas id="energy-chart" style="width:100%;height:100%"></canvas>
      </div>
    </div>
  </div>

  <div style="height:16px"></div>
</div>`;
  }

  requestAnimationFrame(() => {
    destroyCharts();
    mountRadar(rpg);
    mountEnergy(health.energyData || [65, 72, 88, 75, 91, 60, 55]);
  });

  // Auto walk task при LOW RC (§5.2)
  const _rc = calcRC(health, profile);
  if (rcMode(_rc).key === 'low') autoAddWalkTask();

  TG.hideMainButton();
  TG.hideBackButton();
}

// ── ДЕСКТОП-ДАШБОРД (отдельная раскладка с виджетами) ────────────────────────
function десктопныйДашборд(p) {
  const {
    profile, health, tasks, daily, rpg, level, prog, needXp, curXp, mult,
    doneTasks, динамичныеКвесты, liveQuests, doneQuests,
    earned, spent, balance, ratio, todayStats, unlockedAchs, photoSrc,
  } = p;

  const stat = (i, v, l, c) => `<div class="stat-chip">
    <div style="font-size:22px;margin-bottom:4px">${i}</div>
    <div class="num" style="font-size:18px;color:${c}">${v}</div>
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${l}</div>
  </div>`;

  // СОСТОЯНИЕ ГЕРОЯ — радар + шкалы + энергия
  const heroState = `<div class="card">
    <div class="sec-label">📊 СОСТОЯНИЕ ГЕРОЯ</div>
    <div style="width:100%;height:250px;position:relative;margin-top:4px">
      <canvas id="radar-chart" style="width:100%;height:100%"></canvas>
    </div>
    <div style="margin-top:14px">
      ${RPG_STATS.map(s => {
        const val = typeof rpg[s.key] === 'number' ? rpg[s.key] : 50;
        return `<div class="stat-row" style="margin-bottom:7px">
          <div class="stat-label" style="color:${s.color};font-size:10px;min-width:64px">${s.label}</div>
          <div class="stat-bar" style="flex:1;height:7px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;margin:0 8px">
            <div style="height:100%;width:${val}%;background:${s.color};box-shadow:0 0 6px ${s.color}60;border-radius:4px;transition:width .4s ease"></div>
          </div>
          <div style="color:${s.color};font-size:11px;font-weight:700;min-width:24px;text-align:right">${val}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:14px">
      <div style="font-size:9px;color:rgba(232,237,245,.35);letter-spacing:.08em;margin-bottom:6px">⚡ ЭНЕРГИЯ / НЕДЕЛЯ</div>
      <div style="height:80px;position:relative"><canvas id="energy-chart" style="width:100%;height:100%"></canvas></div>
    </div>
  </div>`;

  // КВЕСТЫ ДНЯ
  const questsCard = `<div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">⚡ КВЕСТЫ ДНЯ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${liveQuests.length} активных · ${doneQuests.length} ✓</span>
    </div>
    ${динамичныеКвесты.map(q => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer"
           onclick="window.${q.done ? 'resetQuest' : 'completeQuest'}('${q.id}')">
        <div style="width:28px;height:28px;border-radius:8px;background:${q.done ? 'rgba(0,245,212,.15)' : 'rgba(255,255,255,.05)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${q.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:${q.done ? 'rgba(232,237,245,.35)' : '#E8EDF5'};${q.done ? 'text-decoration:line-through' : ''};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${q.title}</div>
          <div style="font-size:9px;color:rgba(0,245,212,.6);margin-top:1px">${q.done ? '✓ выполнено' : '+' + q.xp + ' XP'}</div>
        </div>
        <div style="font-size:18px;flex-shrink:0">${q.done ? '✅' : '⬜'}</div>
      </div>`).join('')}
  </div>`;

  // ДОСТИЖЕНИЯ
  const achCard = unlockedAchs.length > 0 ? `<div class="card">
    <div class="sec-label">🏆 ДОСТИЖЕНИЯ</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      ${unlockedAchs.slice(0, 6).map(a => `
        <div style="background:${a.color}08;border:1px solid ${a.color}22;border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:8px">
          <span style="font-size:20px">${a.icon}</span>
          <div style="min-width:0">
            <div style="font-size:11px;font-weight:600;color:${a.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
            <div style="font-size:9px;color:rgba(232,237,245,.3)">✓ Получено</div>
          </div>
        </div>`).join('')}
    </div>
  </div>` : '';

  return `<div class="screen dd">
    <!-- ГЕРОЙ-БАННЕР -->
    <div class="dd-hero">
      <div class="dd-hero-photo">
        <img src="${photoSrc}" alt="${profile.name}" onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,#0a1628,#1a0a2e)'" style="width:100%;height:100%;object-fit:cover;display:block">
      </div>
      <div class="dd-hero-info">
        <div class="num dd-hero-name">${profile.name}</div>
        <div class="dd-hero-tag">${profile.tagline || 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР'}</div>
        <div class="dd-hero-badges">
          <span class="level-badge" style="border:1px solid rgba(0,245,212,.3);color:#00F5D4;font-weight:800">УР. ${level}</span>
          <span class="streak-badge"><span class="flame" style="font-size:13px">🔥</span><span class="num" style="color:#FFD700;font-size:13px">${profile.streak || 1}</span><span style="font-size:9px;color:rgba(232,237,245,.6)">страйк${mult ? ' · ' + mult : ''}</span></span>
          <button onclick="window._openAnalytics()" style="padding:5px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#E8EDF5;font-size:11px;cursor:pointer">📊 Аналитика</button>
        </div>
        <div class="row" style="justify-content:space-between;margin:14px 0 5px">
          <span style="font-size:10px;color:rgba(232,237,245,.5);letter-spacing:.08em">XP · УР.${level}</span>
          <span class="num" style="font-size:10px;color:#00F5D4">${curXp.toLocaleString()} / ${needXp.toLocaleString()}</span>
        </div>
        <div class="xp-bar"><div class="xp-fill" style="width:${(prog * 100).toFixed(1)}%"></div></div>
      </div>
      <div class="dd-hero-balance">${renderBalanceBlock(balance, earned, spent, ratio, todayStats)}</div>
    </div>

    <!-- СТАТЫ -->
    <div class="dd-stats">
      ${stat('🌙', (health.sleep?.hours || 7.2) + 'ч', 'Сон', '#7B61FF')}
      ${stat('⚡', (daily.energy || 7) + '/10', 'Энергия', '#FFD700')}
      ${stat('✅', `${doneTasks}/${tasks.length}`, 'Задачи', '#00F5D4')}
      ${stat('🎯', (daily.focus || 2.5) + 'ч', 'Фокус', '#00E396')}
    </div>

    ${renderQ1Alert(tasks)}

    <!-- 3 КОЛОНКИ ВИДЖЕТОВ -->
    <div class="dd-grid">
      <div class="dd-col">
        ${renderRcBlock(health, profile)}
        ${heroState}
      </div>
      <div class="dd-col">
        ${renderCheckinBlock(daily)}
        ${renderTimelineBlock(tasks)}
        ${renderFocusBlock(tasks, health, profile)}
      </div>
      <div class="dd-col">
        ${questsCard}
        ${renderInboxBlock()}
        ${achCard}
      </div>
    </div>

    <div style="height:8px"></div>
  </div>`;
}

// ── БЛОК ДОФАМИН-БАЛАНСА ─────────────────────────────────────────────────────
function renderBalanceBlock(balance, earned, spent, ratio, today) {
  const цвет   = balance < 0 ? '#FF4560' : balance < 15 ? '#FFD700' : '#00F5D4';
  const иконка = balance < 0 ? '🔴' : balance < 15 ? '🟡' : '🟢';
  const статус = balance < 0 ? 'Стоп — сначала заработай' : balance < 15 ? 'Почти пусто' : 'Можно тратить';
  const ratioColor = ratio > 0.7 ? '#FF4560' : ratio > 0.4 ? '#FFD700' : '#00F5D4';
  const ratioW = Math.min(100, Math.round(ratio * 100));

  return `
  <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:rgba(232,237,245,.7)">⚡ ДОФАМИН-БАЛАНС</div>
      <div style="font-size:10px;color:${цвет}">${иконка} ${статус}</div>
    </div>

    <div class="row" style="align-items:flex-end;gap:6px;margin-bottom:12px">
      <div class="num" style="font-size:40px;font-weight:900;color:${цвет};line-height:1">${balance >= 0 ? '+' : ''}${balance}</div>
      <div style="padding-bottom:6px">
        <div style="font-size:9px;color:rgba(232,237,245,.4);letter-spacing:.05em">БАЛЛОВ</div>
        <div style="font-size:9px;color:rgba(232,237,245,.3)">заработал − потратил</div>
      </div>
      <button onclick="window.openPleasureSpend()" ${balance <= 0 ? 'disabled' : ''}
        style="margin-left:auto;background:${balance > 0 ? 'rgba(0,245,212,.12)' : 'rgba(255,255,255,.04)'};border:1px solid ${balance > 0 ? 'rgba(0,245,212,.35)' : 'rgba(255,255,255,.08)'};border-radius:10px;padding:9px 16px;cursor:${balance > 0 ? 'pointer' : 'not-allowed'};font-size:12px;font-weight:700;color:${balance > 0 ? '#00F5D4' : 'rgba(232,237,245,.2)'}">
        Потратить 🎁
      </button>
    </div>

    <div class="row" style="gap:6px;margin-bottom:10px">
      <div style="flex:1;background:rgba(0,245,212,.07);border-radius:8px;padding:7px 8px;text-align:center">
        <div class="num" style="font-size:16px;color:#00F5D4">${earned}</div>
        <div style="font-size:8px;color:rgba(232,237,245,.4);margin-top:1px;letter-spacing:.04em">ЗАРАБОТАНО</div>
      </div>
      <div style="flex:1;background:rgba(255,69,96,.07);border-radius:8px;padding:7px 8px;text-align:center">
        <div class="num" style="font-size:16px;color:#FF6B6B">${spent}</div>
        <div style="font-size:8px;color:rgba(232,237,245,.4);margin-top:1px;letter-spacing:.04em">ПОТРАЧЕНО</div>
      </div>
      <div style="flex:1;background:rgba(123,97,255,.07);border-radius:8px;padding:7px 8px;text-align:center">
        <div class="num" style="font-size:16px;color:#7B61FF">${today.earned > 0 ? '+' + today.earned : (today.spent > 0 ? '−' + today.spent : '0')}</div>
        <div style="font-size:8px;color:rgba(232,237,245,.4);margin-top:1px;letter-spacing:.04em">СЕГОДНЯ</div>
      </div>
    </div>

    <div class="row" style="justify-content:space-between;margin-bottom:4px">
      <div style="font-size:9px;color:rgba(232,237,245,.4)">Доля удовольствий</div>
      <div style="font-size:9px;color:${ratioColor};font-weight:700">${ratioW}% ${ratioW > 70 ? '⚠️' : ratioW > 40 ? '⚡' : '✓'}</div>
    </div>
    <div style="height:5px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${ratioW}%;background:${ratioColor};border-radius:4px;transition:width .4s ease"></div>
    </div>
    <div style="font-size:8px;color:rgba(232,237,245,.2);margin-top:3px">Цель: держать ниже 50%</div>
  </div>`;
}

// ── КАТАЛОГ УДОВОЛЬСТВИЙ — модал ──────────────────────────────────────────────
window.openPleasureSpend = function() {
  const баланс = DB.getBalance();
  const каталог = DB.getPleasureCatalog();

  const div = document.createElement('div');
  div.id = 'pleasure-modal';
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <div style="font-size:15px;font-weight:800">🎁 На что потратить?</div>
      <button onclick="document.getElementById('pleasure-modal')?.remove()" style="background:none;border:none;color:rgba(232,237,245,.5);font-size:22px;cursor:pointer">×</button>
    </div>
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:14px">Ты заработал эти баллы честным трудом — трать без вины</div>

    <div style="background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:12px;padding:12px 16px;margin-bottom:16px;text-align:center">
      <div style="font-size:10px;color:rgba(232,237,245,.5);letter-spacing:.08em;margin-bottom:3px">БАЛАНС</div>
      <div class="num" style="font-size:32px;color:#00F5D4;font-weight:900">${баланс > 0 ? '+' : ''}${баланс}</div>
      <div style="font-size:9px;color:rgba(232,237,245,.4);margin-top:2px">баллов</div>
    </div>

    <div style="font-size:9px;color:rgba(232,237,245,.35);letter-spacing:.1em;margin-bottom:8px">ВЫБЕРИ УДОВОЛЬСТВИЕ</div>
    ${каталог.map(p => {
      const доступно = баланс >= p.cost;
      return `<button onclick="window.buyPleasure('${p.id}')" ${!доступно ? 'disabled' : ''}
        style="width:100%;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,${доступно ? '.08' : '.03'});border-radius:10px;padding:11px 12px;margin-bottom:6px;cursor:${доступно ? 'pointer' : 'default'};opacity:${доступно ? '1' : '.4'};text-align:left">
        <span style="font-size:22px;width:28px;text-align:center">${p.icon}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:#E8EDF5">${p.name}</div>
          <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:1px">${!доступно ? `Нужно ещё ${p.cost - баланс} баллов` : 'Заработано честно ✓'}</div>
        </div>
        <div style="text-align:right">
          <div class="num" style="font-size:16px;color:${доступно ? '#FFD700' : 'rgba(232,237,245,.25)'};font-weight:800">−${p.cost}</div>
          <div style="font-size:8px;color:rgba(232,237,245,.3)">баллов</div>
        </div>
      </button>`;
    }).join('')}

    <div style="font-size:10px;color:rgba(232,237,245,.2);text-align:center;margin-top:12px;line-height:1.7;padding:0 8px">
      Быстрый дофамин без заслуги разрушает фокус.<br>
      Здесь — только то, что ты заработал ✦
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  TG.hapticImpact('light');
};

window.buyPleasure = function(pleasureId) {
  const р = DB.потратитьУдовольствие(pleasureId);
  if (!р.ok) {
    window.showToast?.(р.reason, 'error');
    TG.hapticImpact('medium');
    return;
  }
  document.getElementById('pleasure-modal')?.remove();
  window.showToast?.(`${р.item.icon} ${р.item.name} · −${р.item.cost} баллов · остаток: ${р.balance}`, 'success');
  TG.hapticSuccess();
  renderDash();
};

window.toggleTaskFromDash = function(id) {
  const т = DB.toggleTask(id);
  if (т) {
    if (т.done) {
      window.showToast?.(`+${т.xpValue || 10} баллов 🎯`, 'success');
    }
    renderDash();
  }
};

window.completeQuest = function(id) {
  // Берём taskId из динамического квеста (там он есть), а не из DB (там нет)
  const dynQ = _currentQuests.find(q => q.id === id);
  const q = DB.completeQuest(id);
  if (q) {
    if (dynQ?.taskId) DB.toggleTask(dynQ.taskId); // синхронизируем задачу
    window.showToast?.(`${q.icon} ${(dynQ?.title || q.title).slice(0, 30)} · +${q.xp} XP`, 'success');
    TG.hapticSuccess();
    renderDash();
  }
};

window.resetQuest = function(id) {
  const q = DB.resetQuest(id);
  if (q) {
    window.showToast?.(`↩️ Квест отменён`, 'info');
    TG.hapticImpact('light');
    renderDash();
  }
};

window.ciPickMood = function(m) {
  window._ciMood = m;
  document.querySelectorAll('[id^="ci-mood-"]').forEach(b => {
    const active = b.id === 'ci-mood-' + m;
    b.style.background = active ? 'rgba(0,245,212,.15)' : 'rgba(255,255,255,.04)';
    b.style.border = `1px solid ${active ? 'rgba(0,245,212,.4)' : 'rgba(255,255,255,.08)'}`;
  });
};

window.ciVoiceNote = function() {
  // Запускаем голосовой захват, результат вставляем в поле заметки
  if (!window.openVoiceCapture) { window.showToast?.('🎙️', 'Голос недоступен', '', ''); return; }

  const origHook = window._voiceCaptureCallback;
  window._voiceCaptureCallback = function(text) {
    const ta = document.getElementById('ci-note');
    if (ta) {
      ta.value = ta.value ? ta.value + ' ' + text : text;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
    window._voiceCaptureCallback = origHook;
    TG.hapticSuccess();
  };
  window.openVoiceCapture?.('checkin');
};

window.submitCheckin = function() {
  const energy = parseInt(document.getElementById('ci-energy')?.value || '7');
  const mood   = window._ciMood || DB.getDailyLog()?.mood || '😊';
  const note   = document.getElementById('ci-note')?.value?.trim() || '';

  const log = { ...DB.getDailyLog(), energy, mood, note };
  DB.saveDailyLog(log);

  // Обновляем WIS шкалу (+5 за чекин)
  const шкалы = DB.getRpgStats();
  шкалы.WIS = Math.min(100, (шкалы.WIS || 48) + 5);
  DB.set('rpgStats', шкалы);

  // XP за дневник
  awardXP(10, 'daily_log');

  window.showToast?.('☀️ Чекин записан · +10 XP · MIND +5', 'success');
  window._ciMood = null;
  renderDash();
};

window.setFocusFilter = function(f) {
  focusFilter = f;
  // Скрываем меню категорий при выборе
  const m = document.getElementById('cat-menu');
  if (m) m.style.display = 'none';
  renderDash();
};

window.toggleCatMenu = function() {
  const m = document.getElementById('cat-menu');
  if (!m) return;
  m.style.display = m.style.display === 'none' ? 'flex' : 'none';
};

window.toggleInboxGroup = function(groupId) {
  const блок = document.getElementById(groupId);
  const стрелка = document.getElementById(groupId + '-arr');
  if (!блок) return;
  const открыт = блок.style.display !== 'none';
  блок.style.display = открыт ? 'none' : 'block';
  if (стрелка) стрелка.style.transform = открыт ? 'none' : 'rotate(180deg)';
};

// ── СФЕРА-АВАТАР (Живой Организм) ────────────────────────────────────────────
function renderSphere(health, profile, tasks) {
  const rc     = calcRC(health, profile);
  const mode   = rcMode(rc);
  const rpg    = DB.getRpgStats();
  const debuff = Object.values(rpg).some(v => typeof v === 'number' && v < 30);
  const balance = DB.getBalance();

  // Класс сферы: debuff > low > norm > high
  const cls = debuff ? 'debuff' : mode.key;

  // Подпись под сферой
  const labels = {
    high:   { icon:'🚀', text:'ВЫСОКИЙ ЗАРЯД',   sub:'Берись за стратегию' },
    norm:   { icon:'⚡', text:'В РЕСУРСЕ',        sub:'Стандартный режим' },
    low:    { icon:'🐢', text:'РЕЖИМ СПЯЧКИ',     sub:'Только рутина и отдых' },
    debuff: { icon:'⚠️', text:'ИСТОЩЕНИЕ',         sub:'Шкала в критической зоне' },
  };
  const lbl = labels[cls];

  // Q1 активных задач
  const q1done  = tasks.filter(t => t.quadrant === 'do' && t.done).length;
  const q1total = tasks.filter(t => t.quadrant === 'do').length;

  return `<div style="background:rgba(255,255,255,.025);border-radius:16px;margin-bottom:12px;padding:14px 16px;border:1px solid rgba(255,255,255,.06);overflow:hidden;position:relative">
    <!-- Фоновое свечение -->
    <div style="position:absolute;inset:0;border-radius:16px;background:radial-gradient(ellipse at 50% -20%, ${cls==='high'?'rgba(0,245,212,.08)':cls==='norm'?'rgba(123,97,255,.08)':cls==='low'?'rgba(255,69,96,.06)':'rgba(100,100,100,.05)'}, transparent 70%);pointer-events:none"></div>

    <div style="display:flex;align-items:center;gap:16px;position:relative">
      <!-- Сфера -->
      <div class="sphere ${cls}"></div>

      <!-- Инфо справа -->
      <div style="flex:1">
        <div style="font-size:9px;letter-spacing:.1em;color:rgba(232,237,245,.35);margin-bottom:4px">СОСТОЯНИЕ ОРГАНИЗМА</div>
        <div style="font-size:15px;font-weight:800;color:${cls==='high'?'#00F5D4':cls==='norm'?'#7B61FF':cls==='low'?'#FF6B6B':'#888'}">${lbl.icon} ${lbl.text}</div>
        <div style="font-size:11px;color:rgba(232,237,245,.45);margin-top:2px">${lbl.sub}</div>

        <!-- Мини-прогресс Q1 -->
        <div style="margin-top:8px;display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${q1total?Math.round(q1done/q1total*100):0}%;background:${cls==='high'?'#00F5D4':'#7B61FF'};border-radius:2px;transition:width .4s"></div>
          </div>
          <span style="font-size:9px;color:rgba(232,237,245,.35)">${q1done}/${q1total} Q1</span>
          <span style="font-size:9px;color:rgba(232,237,245,.35)">·</span>
          <span style="font-size:9px;color:${balance>=0?'#00F5D4':'#FF4560'}">${balance>=0?'+':''}${balance} dp</span>
        </div>
      </div>
    </div>
  </div>`;
}

// ── AUTO WALK TASK (LOW RC §5.2) ──────────────────────────────────────────────
function autoAddWalkTask() {
  const сегодня = new Date().toDateString();
  const p = DB.getProfile();
  if (p.lastWalkTaskDate === сегодня) return; // уже добавляли

  const exists = DB.getTasks().some(t =>
    !t.done && !t.cancelled &&
    (t.text.toLowerCase().includes('прогулк') || t.text.toLowerCase().includes('walk'))
  );
  if (exists) return;

  DB.addTask({
    text: '🚶 Прогулка на свежем воздухе 40 мин',
    cat: 'Здоровье',
    quadrant: 'delegate',
    time: 'сегодня',
    xpValue: 30,
    notes: 'Автодобавлено: RC < 0.8, режим восстановления',
  });

  p.lastWalkTaskDate = сегодня;
  DB.saveProfile(p);
  window.showToast?.('🚶 Добавлена прогулка 40 мин (+30 XP повышенных)', 'info');
}

// ── DAILY CHECK-IN ────────────────────────────────────────────────────────────
function renderCheckinBlock(daily) {
  if (DB.isCheckinDoneToday()) return ''; // уже заполнен — не показываем

  const moods = ['😴','😔','😐','🙂','😊','🤩'];
  return `<div class="card" style="margin-bottom:12px;border:1px solid rgba(0,245,212,.2);background:rgba(0,245,212,.04)">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0;color:#00F5D4">☀️ КАК ТЫ СЕГОДНЯ?</div>
      <span style="font-size:9px;color:rgba(232,237,245,.3)">+10 XP за MIND</span>
    </div>

    <!-- Энергия: слайдер -->
    <div style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <div style="font-size:11px;color:rgba(232,237,245,.5)">Энергия</div>
        <div id="ci-energy-val" style="font-size:12px;font-weight:700;color:#FFD700">${daily.energy || 7}/10</div>
      </div>
      <input type="range" id="ci-energy" min="1" max="10" value="${daily.energy || 7}"
        oninput="document.getElementById('ci-energy-val').textContent=this.value+'/10'"
        style="width:100%;accent-color:#FFD700;cursor:pointer">
    </div>

    <!-- Настроение: emoji-пикер -->
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:rgba(232,237,245,.5);margin-bottom:8px">Настроение</div>
      <div style="display:flex;gap:8px;justify-content:space-between">
        ${moods.map(m => `<button onclick="window.ciPickMood('${m}')" id="ci-mood-${m}" style="
          font-size:22px;background:${(daily.mood||'😊')===m?'rgba(0,245,212,.15)':'rgba(255,255,255,.04)'};
          border:1px solid ${(daily.mood||'😊')===m?'rgba(0,245,212,.4)':'rgba(255,255,255,.08)'};
          border-radius:10px;padding:6px 8px;cursor:pointer;flex:1;transition:all .15s
        ">${m}</button>`).join('')}
      </div>
    </div>

    <!-- Заметка + голос -->
    <div style="display:flex;gap:8px;margin-bottom:12px;align-items:flex-start">
      <textarea id="ci-note" class="input" rows="2" placeholder="Как ощущаешь день? Что важного…"
        style="flex:1;font-size:12px;resize:none">${daily.note||''}</textarea>
      <button onclick="window.ciVoiceNote()" title="Голосом"
        style="flex-shrink:0;width:42px;height:52px;border-radius:10px;border:1px solid rgba(0,245,212,.25);
               background:rgba(0,245,212,.08);color:#00F5D4;font-size:18px;cursor:pointer">🎙️</button>
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="window.submitCheckin()" class="btn btn-teal" style="flex:3;padding:11px;font-size:12px">
        Записать ✓
      </button>
    </div>
  </div>`;
}

// ── Q1 > 5 ПРЕДУПРЕЖДЕНИЕ ────────────────────────────────────────────────────
function renderQ1Alert(tasks) {
  const q1 = tasks.filter(t => t.quadrant === 'do' && !t.done && !t.cancelled);
  if (q1.length <= 5) return '';
  return `<div style="
    background:rgba(255,69,96,.08);border:1px solid rgba(255,69,96,.3);
    border-radius:12px;padding:12px 14px;margin-bottom:12px;
    display:flex;align-items:center;gap:10px
  ">
    <div style="font-size:22px;flex-shrink:0">⚠️</div>
    <div>
      <div style="font-size:12px;font-weight:700;color:#FF4560;margin-bottom:2px">
        Искусственный кризис — ${q1.length} срочных задач
      </div>
      <div style="font-size:10px;color:rgba(232,237,245,.5);line-height:1.4">
        Q1 > 5 — это не приоритеты, это паника. Отмени или делегируй лишние.
      </div>
    </div>
  </div>`;
}

// ── REAL CAPACITY БЛОК ───────────────────────────────────────────────────────
function renderRcBlock(health, profile) {
  const rc   = calcRC(health, profile);
  const mode = rcMode(rc);
  const pct  = Math.min(100, Math.round(rc * 100));

  // Градиент прогресс-бара: красный(0) → жёлтый(80%) → зелёный(110%+)
  const barColor = mode.key === 'high' ? '#00F5D4' : mode.key === 'norm' ? '#FFD700' : '#FF6B6B';

  // Рекомендации по режиму
  const tips = {
    high: ['Закрой топ Q1 за утро', 'Запланируй сложную встречу', 'Двигай стратегию вперёд'],
    norm: ['Обычный ритм, не перегружай', 'Q1 + пара Q2-задач', 'Есть время для обучения'],
    low:  ['Только рутина и чеклисты', 'Не принимай важных решений', 'Сон и восстановление в приоритете'],
  };
  const совет = tips[mode.key][Math.floor(Math.random() * 3)];

  return `<div class="card" style="margin-bottom:12px;border-left:3px solid ${barColor}">
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;color:rgba(232,237,245,.5)">⚡ РЕАЛЬНАЯ ЁМКОСТЬ</div>
      <div style="font-size:13px;font-weight:800;color:${barColor}">${mode.label}</div>
    </div>

    <!-- RC прогресс-бар -->
    <div style="height:6px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;margin-bottom:8px">
      <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .5s ease;box-shadow:0 0 8px ${barColor}60"></div>
    </div>

    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <div style="font-size:11px;color:rgba(232,237,245,.6)">${mode.hint}</div>
      <div style="font-size:11px;font-weight:700;color:${barColor}">${rc.toFixed(2)}</div>
    </div>

    <!-- Формула: сон + HRV -->
    <div class="row" style="gap:8px">
      <div style="flex:1;background:rgba(255,255,255,.03);border-radius:8px;padding:7px 10px;text-align:center">
        <div style="font-size:16px;margin-bottom:2px">🌙</div>
        <div class="num" style="font-size:13px;color:${health?.sleep?.hours >= 7 ? '#00E396' : '#FF9F43'}">${health?.sleep?.hours ?? 7.2}ч</div>
        <div style="font-size:8px;color:rgba(232,237,245,.3);margin-top:1px">сон</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,.03);border-radius:8px;padding:7px 10px;text-align:center">
        <div style="font-size:16px;margin-bottom:2px">💚</div>
        <div class="num" style="font-size:13px;color:${(health?.hrv ?? 55) >= 50 ? '#00E396' : '#FF9F43'}">${health?.hrv ?? 55} мс</div>
        <div style="font-size:8px;color:rgba(232,237,245,.3);margin-top:1px">HRV</div>
      </div>
      <div style="flex:2;background:rgba(255,255,255,.03);border-radius:8px;padding:7px 12px;display:flex;align-items:center">
        <div style="font-size:10px;color:rgba(232,237,245,.45);line-height:1.4">💡 ${совет}</div>
      </div>
    </div>
  </div>`;
}

// ── КАТЕГОРИИ для фильтра ────────────────────────────────────────────────────
const WORK_CATS  = new Set(['Работа','Контент','Эксперименты','Стратегия','Обучение','Деньги','Бизнес','Клуб','Операционка','Привлечение клиентов','Развитие','Эффективность']);
const LIFE_CATS  = new Set(['Семья','Встречи','Быт','Здоровье','Chill','Личное','Личные дела','Домашние дела']);
const ALL_CATS   = ['Работа','Контент','Эксперименты','Семья','Встречи','Быт','Стратегия','Обучение','Деньги','Здоровье','Chill','Личное'];

// ── РАСПИСАНИЕ ДНЯ (таймлайн) ─────────────────────────────────────────────────
function renderTimelineBlock(allTasks) {
  // Локальная дата сегодня (YYYY-MM-DD по местному времени, не UTC)
  const сейчас = new Date();
  const ло = n => String(n).padStart(2, '0');
  const сегодняСтр = `${сейчас.getFullYear()}-${ло(сейчас.getMonth()+1)}-${ло(сейчас.getDate())}`;

  // Задачи на сегодня с конкретным временем (start_iso содержит 'T...')
  const сВременем = allTasks
    .filter(t => !t.done && !t.cancelled && t.start_iso && t.start_iso.includes('T'))
    .map(t => {
      const d = new Date(t.start_iso);
      // Локальная дата задачи (а не UTC-split) — чтобы вечерние задачи не уезжали на день
      const локДата = isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${ло(d.getMonth()+1)}-${ло(d.getDate())}`;
      return { ...t, _d: d, _date: локДата };
    })
    .filter(t => t._date === сегодняСтр)
    .sort((a, b) => a._d - b._d);

  // Если на сегодня нет задач с временем — блок не показываем
  if (сВременем.length === 0) return '';

  const иконкаКв = { do:'⚡', schedule:'🏔️', delegate:'⚙️', eliminate:'🌀' };
  const цветКв   = { do:'#FF4560', schedule:'#00F5D4', delegate:'#7B61FF', eliminate:'rgba(232,237,245,.4)' };
  const сейчасTS = сейчас.getTime();

  // Ближайшая будущая задача — подсветим
  const ближайшая = сВременем.find(t => t._d.getTime() > сейчасTS);

  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="sec-label" style="margin:0">🗓️ РАСПИСАНИЕ ДНЯ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${сВременем.length} по времени</span>
    </div>
    <div style="position:relative;padding-left:6px">
      ${сВременем.map(t => {
        const прошло  = t._d.getTime() < сейчасTS;
        const текущая = ближайшая && t.id === ближайшая.id;
        const цвет    = цветКв[t.quadrant] || '#00F5D4';
        const время   = t._d.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
        return `<div onclick="window.openTaskDetail?.('${t.id}')" style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;cursor:pointer;opacity:${прошло ? '.4' : '1'}">
          <div style="flex-shrink:0;width:42px;text-align:right">
            <div class="num" style="font-size:12px;font-weight:700;color:${текущая ? цвет : 'rgba(232,237,245,.7)'}">${время}</div>
          </div>
          <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding-top:2px">
            <div style="width:10px;height:10px;border-radius:50%;background:${текущая ? цвет : 'transparent'};border:2px solid ${цвет};box-shadow:${текущая ? `0 0 8px ${цвет}` : 'none'}"></div>
            <div style="width:2px;flex:1;min-height:14px;background:rgba(255,255,255,.08);margin-top:2px"></div>
          </div>
          <div style="flex:1;min-width:0;padding-bottom:2px">
            <div style="font-size:12px;font-weight:600;color:#E8EDF5;${прошло ? 'text-decoration:line-through' : ''}">${иконкаКв[t.quadrant] || '📋'} ${t.text}</div>
            <div style="font-size:9px;color:rgba(232,237,245,.4);margin-top:2px">${t.cat || ''}${t.duration_min ? ` · ${t.duration_min} мин` : ''}${текущая ? ' · 🔜 ближайшая' : прошло ? ' · прошло' : ''}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── ФОКУС ДНЯ ────────────────────────────────────────────────────────────────
function renderFocusBlock(allTasks, health, profile) {
  const rc     = calcRC(health, profile);
  const mode   = rcMode(rc);
  const q1All  = allTasks.filter(t => t.quadrant === 'do'       && !t.done && !t.cancelled);
  const q1Done = allTasks.filter(t => t.quadrant === 'do'       && t.done);
  const allQ1Done = q1All.length === 0 && q1Done.length > 0;

  // Применяем фильтр
  function applyFilter(tasks) {
    if (focusFilter === 'work')    return tasks.filter(t => WORK_CATS.has(t.cat));
    if (focusFilter === 'personal') return tasks.filter(t => LIFE_CATS.has(t.cat) || (!WORK_CATS.has(t.cat) && !LIFE_CATS.has(t.cat)));
    if (focusFilter.startsWith('cat:')) return tasks.filter(t => t.cat === focusFilter.slice(4));
    return tasks;
  }

  // Фильтр-панель
  const filterBar = `
  <div style="display:flex;gap:6px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">
    <button onclick="window.setFocusFilter('all')" style="flex-shrink:0;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${focusFilter==='all'?'rgba(0,245,212,.5)':'rgba(255,255,255,.12)'};background:${focusFilter==='all'?'rgba(0,245,212,.15)':'rgba(255,255,255,.04)'};color:${focusFilter==='all'?'#00F5D4':'rgba(232,237,245,.5)'}">Все</button>
    <button onclick="window.setFocusFilter('work')" style="flex-shrink:0;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${focusFilter==='work'?'rgba(0,245,212,.5)':'rgba(255,255,255,.12)'};background:${focusFilter==='work'?'rgba(0,245,212,.15)':'rgba(255,255,255,.04)'};color:${focusFilter==='work'?'#00F5D4':'rgba(232,237,245,.5)'}">💼 Работа</button>
    <button onclick="window.setFocusFilter('personal')" style="flex-shrink:0;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${focusFilter==='personal'?'rgba(255,107,107,.5)':'rgba(255,255,255,.12)'};background:${focusFilter==='personal'?'rgba(255,107,107,.1)':'rgba(255,255,255,.04)'};color:${focusFilter==='personal'?'#FF6B6B':'rgba(232,237,245,.5)'}">🏠 Личное</button>
    <button onclick="window.toggleCatMenu()" style="flex-shrink:0;padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:rgba(232,237,245,.5)">⚙️</button>
  </div>
  <div id="cat-menu" style="display:none;flex-wrap:wrap;gap:5px;margin-bottom:10px">
    ${ALL_CATS.map(c => `<button onclick="window.setFocusFilter('cat:${c}')" style="padding:3px 9px;border-radius:14px;font-size:10px;cursor:pointer;border:1px solid ${focusFilter==='cat:'+c?'rgba(0,245,212,.5)':'rgba(255,255,255,.1)'};background:${focusFilter==='cat:'+c?'rgba(0,245,212,.15)':'rgba(255,255,255,.03)'};color:${focusFilter==='cat:'+c?'#00F5D4':'rgba(232,237,245,.45)'}">${c}</button>`).join('')}
  </div>`;

  // В LOW режиме RC — только рутина и delegate (не Q1)
  if (mode.key === 'low') {
    const рутина = allTasks.filter(t => !t.done && !t.cancelled && (t.quadrant === 'delegate' || LIFE_CATS.has(t.cat)));
    const показ  = applyFilter(рутина).slice(0, 3);
    // §5.2: предложить перенести Q1 с difficulty ≥ 4 в Q2
    const heavyQ1 = allTasks.filter(t => !t.done && !t.cancelled && t.quadrant === 'do' && (t.difficulty || 2) >= 4);
    const heavyBanner = heavyQ1.length > 0 ? `
      <div style="background:rgba(255,69,96,.06);border:1px solid rgba(255,69,96,.2);border-radius:10px;padding:10px 12px;margin-bottom:10px">
        <div style="font-size:10px;color:#FF4560;font-weight:700;margin-bottom:5px">⚠️ ${heavyQ1.length} тяжёлых Q1 при низком RC</div>
        <div style="font-size:10px;color:rgba(232,237,245,.5);margin-bottom:8px">Перенести в Q2 чтобы не угробить себя?</div>
        ${heavyQ1.slice(0,3).map(t => `
          <div class="row" style="gap:6px;margin-bottom:5px">
            <span style="flex:1;font-size:10px;color:#E8EDF5;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${t.text}</span>
            <button onclick="window.rcMoveToQ2('${t.id}')"
              style="flex-shrink:0;padding:3px 8px;border-radius:7px;border:1px solid rgba(255,69,96,.3);
                     background:rgba(255,69,96,.1);color:#FF4560;font-size:9px;cursor:pointer">→ Q2</button>
          </div>`).join('')}
      </div>` : '';
    return `<div class="card" style="margin-bottom:12px;border-left:3px solid #FF6B6B">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <div class="sec-label" style="margin:0;color:#FF6B6B">🐢 РЕЖИМ ВОССТАНОВЛЕНИЯ</div>
        <span class="badge" style="background:rgba(255,107,107,.12);color:#FF6B6B;border:1px solid rgba(255,107,107,.25)">RC ${rc.toFixed(2)}</span>
      </div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:10px">HRV или сон в красной зоне — сегодня только рутина</div>
      ${heavyBanner}
      ${filterBar}
      ${показ.length
        ? показ.map((t, i) => renderFocusItem(t, i, показ.length)).join('')
        : `<div style="text-align:center;padding:12px 0;font-size:12px;color:rgba(232,237,245,.3)">Отдыхай — задач нет</div>`}
    </div>`;
  }

  // Если все Q1 выполнены — показываем Q2
  if (allQ1Done) {
    const q2 = applyFilter(allTasks.filter(t => t.quadrant === 'schedule' && !t.done)).slice(0, 3);
    return `<div class="card" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:6px">
        <div class="sec-label" style="margin:0">🎯 ФОКУС ДНЯ</div>
        <span class="badge" style="background:rgba(0,245,212,.12);color:#00F5D4;border:1px solid rgba(0,245,212,.25)">Q1 ✓ закрыт!</span>
      </div>
      ${filterBar}
      <div style="background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.15);border-radius:10px;padding:10px 14px;margin-bottom:10px;text-align:center">
        <div style="font-size:18px;margin-bottom:3px">🏆</div>
        <div style="font-size:12px;font-weight:700;color:#00F5D4">Все срочные закрыты!</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">Теперь — задачи роста (Q2)</div>
      </div>
      ${q2.length ? q2.map((t, i) => renderFocusItem(t, i, q2.length)).join('') : '<div style="font-size:11px;color:rgba(232,237,245,.3);text-align:center;padding:8px 0">Нет задач Q2</div>'}
    </div>`;
  }

  const filtered = applyFilter(q1All);
  const показываемые = filtered.slice(0, 3);
  const badge = filtered.length !== q1All.length
    ? `<span class="badge" style="background:rgba(255,215,0,.12);color:#FFD700;border:1px solid rgba(255,215,0,.2)">${filtered.length} из ${q1All.length}</span>`
    : `<span class="badge" style="background:rgba(255,215,0,.12);color:#FFD700;border:1px solid rgba(255,215,0,.2)">${q1All.length} срочных</span>`;

  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:6px">
      <div class="sec-label" style="margin:0">🎯 ФОКУС ДНЯ</div>
      ${badge}
    </div>
    ${filterBar}
    ${показываемые.length
      ? показываемые.map((t, i) => renderFocusItem(t, i, показываемые.length)).join('')
      : `<div style="text-align:center;padding:14px 0">
          <div style="font-size:28px;margin-bottom:4px">✨</div>
          <div style="font-size:12px;color:rgba(232,237,245,.35)">${focusFilter !== 'all' ? 'Нет задач с таким фильтром' : 'Нет срочных задач — отличный день!'}</div>
        </div>`}
  </div>`;
}

function renderFocusItem(t, i, total) {
  const isFirst = i === 0;
  const border  = i < total - 1 ? 'border-bottom:1px solid rgba(255,255,255,.05)' : '';
  const xpBadge = `<span style="font-size:9px;background:rgba(255,215,0,.12);color:#FFD700;border-radius:5px;padding:2px 5px;margin-left:4px">+${t.xpValue || 10}</span>`;
  return `
  <div class="focus-item" onclick="window.openTaskDetail?.('${t.id}')" style="${border}">
    <div class="focus-num" style="background:${isFirst ? 'rgba(0,245,212,.15)' : 'rgba(255,255,255,.06)'};color:${isFirst ? '#00F5D4' : 'rgba(232,237,245,.5)'};border:1px solid ${isFirst ? 'rgba(0,245,212,.3)' : 'rgba(255,255,255,.08)'}">${i + 1}</div>
    <div style="flex:1;padding:0 8px">
      <div style="font-size:13px;font-weight:500">${t.text}${xpBadge}</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${t.cat || ''}${t.time ? ' · ' + t.time : ''}</div>
    </div>
    <div class="checkbox" onclick="event.stopPropagation();window.toggleTaskFromDash?.('${t.id}')" style="cursor:pointer;width:20px;height:20px;font-size:11px;flex-shrink:0"></div>
  </div>`;
}

// ── ЖУРНАЛ / ИНБОКС ──────────────────────────────────────────────────────────
const INBOX_ICONS = {
  task:          '📋',
  idea:          '💡',
  content_idea:  '🎬',
  meeting_notes: '📝',
  decision:      '🔑',
  waiting:       '⏳',
  checkin:       '🌙',
  mood:          '⚡',
  question:      '❓',
  avoidance_mirror: '🪞',
};

function renderInboxBlock() {
  const inbox = DB.getInbox();
  if (!inbox.length) return '';

  // Группируем по дням
  const по_дням = {};
  inbox.forEach(item => {
    const день = new Date(item.created_at).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', weekday: 'short'
    });
    if (!по_дням[день]) по_дням[день] = [];
    по_дням[день].push(item);
  });

  const сегодняStr = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', weekday: 'short'
  });

  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🎙️ ЖУРНАЛ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.35)">${inbox.length} записей</span>
    </div>
    ${Object.entries(по_дням).slice(0, 5).map(([день, записи], groupIdx) => {
      const isToday = день === сегодняStr;
      const открыт = groupIdx === 0; // первый аккордеон открыт
      const groupId = 'inbox-g-' + groupIdx;
      return `
      <div style="margin-bottom:6px">
        <div onclick="window.toggleInboxGroup('${groupId}')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid rgba(255,255,255,.06)">
          <div style="font-size:11px;font-weight:600;color:${isToday ? '#00F5D4' : 'rgba(232,237,245,.6)'}">
            ${isToday ? '● сегодня' : день}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:9px;color:rgba(232,237,245,.3)">${записи.length}</span>
            <span id="${groupId}-arr" style="font-size:10px;color:rgba(232,237,245,.3);transition:transform .2s;display:inline-block;transform:${открыт ? 'rotate(180deg)' : 'none'}">▾</span>
          </div>
        </div>
        <div id="${groupId}" style="display:${открыт ? 'block' : 'none'}">
          ${записи.map(item => {
            const иконка = INBOX_ICONS[item.type] || '📌';
            const время = new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            // Текст — парсим JSON если нужно
            let текст = item.text || '';
            try { const p = JSON.parse(текст); текст = p.text || p.title || p.what || JSON.stringify(p); } catch {}
            текст = String(текст).slice(0, 120);
            return `
            <div style="display:flex;gap:10px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04)">
              <div style="font-size:16px;padding-top:1px;width:20px;flex-shrink:0">${иконка}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:11px;font-weight:500;color:#E8EDF5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${текст}</div>
                <div style="font-size:9px;color:rgba(232,237,245,.3);margin-top:2px">${время} · ${item.type || '?'}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function destroyCharts() {
  if (radarChart)  { try { radarChart.destroy();  } catch {} radarChart  = null; }
  if (energyChart) { try { energyChart.destroy(); } catch {} energyChart = null; }
}

function mountRadar(rpg) {
  const ctx = document.getElementById('radar-chart');
  if (!ctx) return;
  const vals = [rpg.STR ?? 62, rpg.VIT ?? 70, rpg.SOC ?? 55, rpg.WIS ?? 48, rpg.ENG ?? 65];
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['BODY 💪','RCVR ♥️','PPL 🫂','MIND 🧠','NRG ⚡'],
      datasets: [{
        data: vals,
        backgroundColor: 'rgba(0,245,212,.10)',
        borderColor: '#00F5D4',
        borderWidth: 2,
        pointBackgroundColor: '#00F5D4',
        pointBorderColor: '#00F5D4',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          grid:       { color: 'rgba(255,255,255,.08)' },
          angleLines: { color: 'rgba(255,255,255,.08)' },
          pointLabels: {
            color: 'rgba(232,237,245,.65)',
            font: { size: 10, family: 'Manrope', weight: '600' },
          },
          ticks: { display: false, stepSize: 25 },
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

// §5.2 RC LOW: перенос тяжёлых Q1 → Q2 по предложению
window.rcMoveToQ2 = function(id) {
  DB.updateTask(id, { quadrant: 'schedule' });
  window.showToast?.('→ Задача перенесена в Q2 (режим восстановления)', 'info');
  renderDash();
};
