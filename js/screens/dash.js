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
  const mult    = profile.streak >= 30 ? '1.5x' : profile.streak >= 14 ? '1.25x' : profile.streak >= 7 ? '1.1x' : '';
  const doneTasks = tasks.filter(t => t.done).length;
  const unlockedAchs = achs.filter(a => a.unlocked);

  const photoSrc  = profile.photo || 'assets/avatar.jpg';
  const liveQuests = quests.filter(q => !q.done);

  // Дофамин-баланс (механика GAMECHANGER)
  const earned     = DB.getEarned();
  const spent      = DB.getSpent();
  const balance    = DB.getBalance();
  const ratio      = DB.getPleasureRatio();
  const todayStats = DB.getTodayStats();

  const el = document.getElementById('content');
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
        <span class="level-badge" style="background:rgba(0,0,0,.55);backdrop-filter:blur(8px);border:1px solid rgba(0,245,212,.3);color:#00F5D4;font-weight:800">УР. ${level}</span>
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

  <!-- ── КВЕСТЫ ДНЯ ─────────────────────────────────────────────────────────── -->
  <div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">⚡ КВЕСТЫ ДНЯ</div>
      <span style="font-size:10px;color:rgba(232,237,245,.4)">${liveQuests.length} активных · ${quests.length - liveQuests.length} ✓</span>
    </div>
    ${liveQuests.length > 0
      ? `<div class="quests-grid">${liveQuests.map(q => `
        <div class="quest-card" onclick="window.completeQuest('${q.id}')">
          <div class="quest-icon">${q.icon}</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:#E8EDF5">${q.title}</div>
            <div style="font-size:10px;color:rgba(0,245,212,.7);margin-top:2px">+${q.xp} XP · +${q.xp} баллов</div>
          </div>
          <div style="font-size:16px">⬜</div>
        </div>`).join('')}
      </div>`
      : `<div style="text-align:center;padding:18px 8px">
          <div style="font-size:32px;margin-bottom:6px">🎯</div>
          <div style="font-size:13px;font-weight:600;color:#00F5D4;margin-bottom:4px">Все квесты выполнены!</div>
          <div style="font-size:11px;color:rgba(232,237,245,.4)">Новые появятся завтра в 08:00</div>
        </div>`}
  </div>

  <!-- ── ФОКУС ДНЯ ──────────────────────────────────────────────────────────── -->
  ${renderFocusBlock(tasks)}

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
    <div class="grid2">
      <canvas id="radar-chart" style="max-height:155px"></canvas>
      <div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Энергия / неделя</div>
        <canvas id="energy-chart" style="max-height:145px"></canvas>
      </div>
    </div>
    <div style="margin-top:12px">
      ${RPG_STATS.map(s => `<div class="stat-row">
        <div class="stat-label" style="color:${s.color}">${s.label}</div>
        <div class="stat-bar"><div class="stat-bar-fill" style="width:${rpg[s.key]}%;background:${s.color};box-shadow:0 0 6px ${s.color}60"></div></div>
        <div class="stat-val" style="color:${s.color}">${rpg[s.key]}</div>
      </div>`).join('')}
    </div>
  </div>

  <div style="height:16px"></div>
</div>`;

  requestAnimationFrame(() => {
    destroyCharts();
    mountRadar(rpg);
    mountEnergy(health.energyData || [65, 72, 88, 75, 91, 60, 55]);
  });

  TG.hideMainButton();
  TG.hideBackButton();
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

window.toggleInboxGroup = function(groupId) {
  const блок = document.getElementById(groupId);
  const стрелка = document.getElementById(groupId + '-arr');
  if (!блок) return;
  const открыт = блок.style.display !== 'none';
  блок.style.display = открыт ? 'none' : 'block';
  if (стрелка) стрелка.style.transform = открыт ? 'none' : 'rotate(180deg)';
};

// ── ФОКУС ДНЯ ────────────────────────────────────────────────────────────────
function renderFocusBlock(tasks) {
  const q1 = tasks.filter(t => t.quadrant === 'do' && !t.done);
  const q1Done = tasks.filter(t => t.quadrant === 'do' && t.done);
  const allQ1Done = q1.length === 0 && q1Done.length > 0;

  // Если все Q1 выполнены — показываем Q2 как следующие цели
  if (allQ1Done) {
    const q2 = tasks.filter(t => t.quadrant === 'schedule' && !t.done).slice(0, 3);
    return `<div class="card" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div class="sec-label" style="margin:0">🎯 ФОКУС ДНЯ</div>
        <span class="badge" style="background:rgba(0,245,212,.12);color:#00F5D4;border:1px solid rgba(0,245,212,.25)">Q1 ✓ закрыт!</span>
      </div>
      <div style="background:rgba(0,245,212,.06);border:1px solid rgba(0,245,212,.15);border-radius:10px;padding:10px 14px;margin-bottom:10px;text-align:center">
        <div style="font-size:18px;margin-bottom:3px">🏆</div>
        <div style="font-size:12px;font-weight:700;color:#00F5D4">Все срочные закрыты!</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">Теперь — задачи роста (Q2)</div>
      </div>
      ${q2.length ? q2.map((t, i) => renderFocusItem(t, i, q2.length)).join('') : '<div style="font-size:11px;color:rgba(232,237,245,.3);text-align:center;padding:8px 0">Нет задач Q2</div>'}
    </div>`;
  }

  const показываемые = q1.slice(0, 3);
  return `<div class="card" style="margin-bottom:12px">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🎯 ФОКУС ДНЯ</div>
      <span class="badge" style="background:rgba(255,215,0,.12);color:#FFD700;border:1px solid rgba(255,215,0,.2)">${q1.length} срочных</span>
    </div>
    ${показываемые.length
      ? показываемые.map((t, i) => renderFocusItem(t, i, показываемые.length)).join('')
      : `<div style="text-align:center;padding:14px 0">
          <div style="font-size:28px;margin-bottom:4px">✨</div>
          <div style="font-size:12px;color:rgba(232,237,245,.35)">Нет срочных задач — отличный день!</div>
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
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['BODY','RCVR','PPL','MIND','NRG'],
      datasets: [{
        data: [rpg.STR, rpg.VIT, rpg.SOC, rpg.WIS, rpg.ENG],
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
          min: 0, max: 100,
          grid:       { color: 'rgba(255,255,255,.07)' },
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
