// ── ACHIEVEMENTS SCREEN ───────────────────────────────────────────────────────
import { DB } from '../db.js?v=52';
import { levelFromXp, xpProgress, xpForLevel, totalXpForLevel, RPG_STATS } from '../gamification.js?v=52';
import { TG } from '../telegram.js?v=52';

export function renderAchievements() {
  const profile = DB.getProfile();
  const achs    = DB.getAchievements();
  const quests  = DB.getQuests();
  const rpg     = DB.getRpgStats();
  const wc      = DB.getWeeklyChallenge();

  const level   = levelFromXp(profile.xp || 0);
  const prog    = xpProgress(profile.xp || 0);
  const needXp  = xpForLevel(level);
  const curXp   = Math.round(prog * needXp);
  const totalXp = profile.xp || 0;
  const unlocked = achs.filter(a => a.unlocked).length;

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:14px">
    <div>
      <div class="num" style="font-size:16px">ДОСТИЖЕНИЯ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${unlocked} / ${achs.length} получено</div>
    </div>
    <button onclick="window.goBack()" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 12px;color:rgba(232,237,245,.6);font-size:11px;cursor:pointer">← Назад</button>
  </div>

  <div class="level-hero">
    <div class="level-badge" style="font-size:14px;padding:4px 14px;margin-bottom:8px">УР. ${level}</div>
    <div class="num" style="font-size:32px;color:#FFD700;margin-bottom:4px">${totalXp.toLocaleString()} XP</div>
    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:10px">Всего заработано</div>
    <div class="xp-bar"><div class="xp-fill" style="width:${(prog*100).toFixed(1)}%"></div></div>
    <div style="font-size:10px;color:rgba(232,237,245,.35);margin-top:6px">${curXp.toLocaleString()} / ${needXp.toLocaleString()} XP до Уровня ${level+1}</div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">🧬 RPG ХАРАКТЕРИСТИКИ</div>
    ${RPG_STATS.map(s=>`<div class="stat-row">
      <div style="font-size:10px;font-weight:700;width:36px;flex-shrink:0;color:${s.color}">${s.label}</div>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${rpg[s.key]}%;background:${s.color};box-shadow:0 0 6px ${s.color}50"></div></div>
      <div class="stat-val" style="color:${s.color}">${rpg[s.key]}</div>
    </div>
    <div style="font-size:9px;color:rgba(232,237,245,.25);margin:-4px 0 8px 36px">${s.desc}</div>`).join('')}
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">⚡ КВЕСТЫ ДНЯ</div>
    ${quests.map(q=>`<div class="quest-card${q.done?' done':''}" style="margin-bottom:8px" onclick="window.completeQuest('${q.id}')">
      <div class="quest-icon">${q.icon}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;text-decoration:${q.done?'line-through':'none'};color:${q.done?'rgba(232,237,245,.4)':'#E8EDF5'}">${q.title}</div>
        <div style="font-size:10px;color:rgba(0,245,212,.7);margin-top:2px">+${q.xp} XP</div>
      </div>
      <div style="font-size:16px">${q.done?'✅':'⬜'}</div>
    </div>`).join('')}
  </div>

  ${wc ? `<div class="weekly-challenge">
    <div class="row" style="justify-content:space-between;margin-bottom:8px">
      <div class="row" style="gap:8px">
        <span style="font-size:22px">${wc.emoji}</span>
        <div>
          <div style="font-size:10px;font-weight:700;color:#7B61FF;letter-spacing:.05em">ЕЖЕНЕД. ЧЕЛЛЕНДЖ</div>
          <div style="font-size:12px;font-weight:600;margin-top:2px">${wc.title}</div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="num" style="font-size:16px;color:#FFD700">${wc.progress}/${wc.target}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.35)">+${wc.xp} XP</div>
      </div>
    </div>
    <div class="prog-bar" style="height:6px">
      <div class="prog-fill" style="width:${Math.min((wc.progress/wc.target)*100,100)}%;background:linear-gradient(90deg,#7B61FF,#FFD700);box-shadow:0 0 6px rgba(123,97,255,.5)"></div>
    </div>
  </div>` : ''}

  <div style="font-size:11px;color:rgba(232,237,245,.4);letter-spacing:.05em;margin-bottom:10px">
    🏆 ВСЕ ДОСТИЖЕНИЯ <span style="color:#FFD700">${unlocked}/${achs.length}</span>
  </div>
  <div class="ach-grid">
    ${achs.map(a => achBadgeHTML(a)).join('')}
  </div>

  <div style="height:12px"></div>
</div>`;

  TG.showBackButton(window.goBack);
}

function achBadgeHTML(a) {
  if (a.unlocked) {
    return `<div class="ach-badge unlocked">
      <div class="ach-badge-icon">${a.icon}</div>
      <div style="font-size:10px;font-weight:600;color:${a.color}">${a.name}</div>
      <div style="font-size:8px;color:rgba(232,237,245,.3)">✓ Получено</div>
    </div>`;
  }
  return `<div class="ach-badge">
    <div class="ach-badge-icon" style="filter:grayscale(1);opacity:.4">${a.icon}</div>
    <div style="font-size:10px;font-weight:600;color:rgba(232,237,245,.3)">${a.name}</div>
    <div style="font-size:8px;color:rgba(232,237,245,.2)">🔒 Заблок.</div>
  </div>`;
}
