// ── PROJECTS SCREEN ───────────────────────────────────────────────────────────
import { DB } from '../db.js?v=65';
import { TG } from '../telegram.js?v=65';

const MONTH_GOAL = 3000000; // цель по выручке за месяц

function fmt(v) {
  if (v >= 1000000) return `${(v/1000000).toFixed(1)}М`;
  if (v >= 1000)    return `${Math.round(v/1000)}К`;
  return v;
}
function rub(v) { return (v||0).toLocaleString('ru-RU') + ' ₽'; }

// Стабильный псевдослучай из строки (для оценок радара, если нет реальных)
function hashStr(s) { let h=0; for (let i=0;i<(s||'').length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h; }
function metricsFor(p) {
  if (p.metrics) return p.metrics;                 // если заданы вручную
  const h = hashStr(p.id || p.name);
  const j = (n) => 30 + ((h >> n) % 55);           // 30..85
  return {
    sales:     Math.max(p.progress || 0, 20),      // продажи ~ прогресс выручки
    marketing: j(2),
    product:   j(5),
    finance:   p.target ? Math.round((p.current / p.target) * 100) : j(8),
    team:      j(11),
  };
}

// Инлайн-спарклайн
function spark(data, color, h = 40) {
  const w = 200, vals = data.length ? data : [0];
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0), span = max - min || 1;
  const pts = vals.map((v,i)=>`${(vals.length>1?(i/(vals.length-1))*w:w/2).toFixed(1)},${(h-4-((v-min)/span)*(h-8)).toFixed(1)}`);
  const id = 's'+Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${pts.join(' ')} ${w},${h}" fill="url(#${id})"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${color}80)"/>
  </svg>`;
}

export function renderProjects() {
  const projects = DB.getProjects();
  const tasks    = DB.getTasks();
  const totalCurrent = projects.reduce((s,p) => s + (p.current||0), 0);
  const активные = projects.filter(p => p.stage !== 'На паузе');
  const q1Hot    = tasks.filter(t => !t.done && !t.cancelled && t.quadrant === 'do').length;
  const avgProg  = projects.length ? Math.round(projects.reduce((s,p)=>s+(p.progress||0),0)/projects.length) : 0;
  // Грубый прогноз: текущая выручка экстраполирована на месяц
  const dom = new Date().getDate();
  const forecast = Math.round(totalCurrent / Math.max(dom,1) * 30);
  const goalPct = Math.min(100, Math.round(totalCurrent / MONTH_GOAL * 100));

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen proj-os">
    <div class="row" style="justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div>
        <div class="num" style="font-size:22px">ПРОЕКТЫ</div>
        <div style="font-size:11px;color:rgba(232,237,245,.4);margin-top:2px">${активные.length} активных · цель ${fmt(MONTH_GOAL)}₽/мес</div>
      </div>
      <button class="btn btn-teal" onclick="window.openAddProject()">+ Новый проект</button>
    </div>

    <!-- EXECUTIVE KPI -->
    <div class="proj-kpi">
      <div class="card">
        <div class="sec-label">💰 ВЫРУЧКА МЕСЯЦА</div>
        <div class="num" style="font-size:26px;color:#00E396">${rub(totalCurrent)}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin:6px 0 6px">Цель: ${rub(MONTH_GOAL)} · ${goalPct}%</div>
        <div class="prog-bar"><div class="prog-fill" style="width:${goalPct}%;background:linear-gradient(90deg,#00E396,#00F5D4)"></div></div>
      </div>
      <div class="card">
        <div class="sec-label">📈 ПРОГНОЗ МЕСЯЦА</div>
        <div class="num" style="font-size:24px;color:#00D4FF">${rub(forecast)}</div>
        <div style="margin-top:6px">${spark([totalCurrent*0.5, totalCurrent*0.7, totalCurrent*0.85, totalCurrent, forecast], '#00D4FF')}</div>
      </div>
      <div class="card">
        <div class="sec-label">🚀 АКТИВНЫХ</div>
        <div class="num" style="font-size:30px;color:#7C3AED">${активные.length}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:4px">из ${projects.length} всего</div>
      </div>
      <div class="card">
        <div class="sec-label">🔥 ГОРЯЩИХ ЗАДАЧ</div>
        <div class="num" style="font-size:30px;color:#FF5C8A">${q1Hot}</div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:4px">требуют внимания</div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div class="sec-label" style="align-self:flex-start">⚡ СРЕДНИЙ ПРОГРЕСС</div>
        ${ringSmall(avgProg, '#F5B942')}
      </div>
    </div>

    <!-- КАРТОЧКИ ПРОЕКТОВ -->
    <div class="proj-grid">
      ${projects.map(p => projectCardHTML(p, tasks)).join('')}
    </div>

    <!-- РАДАР + ДЕДЛАЙНЫ + AI CEO -->
    <div class="proj-trio">
      ${radarCardHTML(projects)}
      ${deadlinesCardHTML(projects, tasks)}
      ${aiCeoCardHTML(projects)}
    </div>

    <!-- ФИНАНСОВЫЙ ОБЗОР -->
    ${financeCardHTML(projects)}

    <div style="height:8px"></div>
  </div>`;

  TG.hideBackButton();
  TG.hideMainButton();
}

function ringSmall(val, color) {
  const r = 34, circ = 2*Math.PI*r, off = circ - (val/100)*circ;
  return `<div style="position:relative;width:88px;height:88px;margin:6px 0">
    <svg width="88" height="88">
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="7"/>
      <circle cx="44" cy="44" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 44 44)" style="filter:drop-shadow(0 0 5px ${color})"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span class="num" style="font-size:22px;color:${color}">${val}%</span></div>
  </div>`;
}

function projectCardHTML(p, tasks) {
  const tp     = tasks.filter(t => t.project_id === p.id && !t.done && !t.cancelled);
  const q1     = tp.filter(t => t.quadrant === 'do').length;
  const team   = p.team || 1;
  const toGoal = Math.max(0, (p.target||0) - (p.current||0));
  const next   = tp.map(t => t.due_date).filter(Boolean).sort()[0];
  const nextLbl = next ? daysLabel(next) : '—';

  return `<div class="project-card" onclick="window.openProjectDetail('${p.id}')">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <div class="row" style="gap:10px">
        <span style="font-size:28px">${p.emoji}</span>
        <div style="font-weight:800;font-size:17px">${p.name}</div>
      </div>
      <span class="badge" style="background:${p.color}18;color:${p.color};border:1px solid ${p.color}40">${p.stage}</span>
    </div>
    ${p.target > 0 ? `
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:6px">
      <div><div style="font-size:9px;color:rgba(232,237,245,.4)">Выручка за месяц</div><div class="num" style="font-size:20px;color:${p.color}">${rub(p.current)}</div></div>
      <div style="text-align:right"><div style="font-size:9px;color:rgba(232,237,245,.4)">Цель</div><div style="font-size:13px;color:rgba(232,237,245,.6)">${rub(p.target)}</div></div>
    </div>
    <div class="prog-bar" style="height:7px"><div class="prog-fill" style="width:${p.progress}%;background:${p.color};box-shadow:0 0 8px ${p.color}80"></div></div>
    <div class="row" style="justify-content:space-between;margin:4px 0 12px"><span class="num" style="font-size:12px;color:${p.color}">${p.progress}%</span><span style="font-size:10px;color:rgba(232,237,245,.4)">До цели: ${rub(toGoal)}</span></div>
    ` : `<div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:12px">Без финансовой цели</div>`}
    <div class="proj-stats">
      <div><span>👥 Команда</span><b>${team}</b></div>
      <div><span>📋 Задач</span><b>${tp.length}</b></div>
      <div><span>⚡ Приоритет</span><b style="color:#FF5C8A">${q1}</b></div>
      <div><span>📅 Дедлайн</span><b>${nextLbl}</b></div>
    </div>
    <div class="proj-card-actions" onclick="event.stopPropagation()">
      <button onclick="window.openProjectDetail('${p.id}')">Открыть</button>
      <button onclick="window.openProjectDetail('${p.id}')">План</button>
      <button onclick="window.openProjectDetail('${p.id}')">Финансы</button>
    </div>
  </div>`;
}

function daysLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate()) - today) / 86400000);
  if (dd < 0) return `${-dd} дн. назад`;
  if (dd === 0) return 'сегодня';
  if (dd === 1) return 'завтра';
  return `через ${dd} дн.`;
}

// РАДАР: таблица проектов × метрики
function radarCardHTML(projects) {
  const cols = [
    { k:'sales', l:'💰 Продажи' }, { k:'marketing', l:'🔥 Маркетинг' },
    { k:'product', l:'🎯 Продукт' }, { k:'finance', l:'💎 Финансы' }, { k:'team', l:'👥 Команда' },
  ];
  return `<div class="card">
    <div class="sec-label">📡 РАДАР ПРОЕКТОВ</div>
    <div style="font-size:10px;color:rgba(232,237,245,.35);margin-bottom:10px">Оценка по ключевым направлениям</div>
    <div class="radar-tbl">
      <div class="radar-row radar-head"><span>Проект</span>${cols.map(c=>`<span>${c.l.split(' ')[0]}</span>`).join('')}<span>Итог</span></div>
      ${projects.map(p => {
        const m = metricsFor(p);
        const vals = cols.map(c => m[c.k] || 0);
        const tot = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
        const tColor = tot >= 60 ? '#00E396' : tot >= 40 ? '#F5B942' : '#FF5C8A';
        return `<div class="radar-row">
          <span style="color:#E8EDF5">${p.emoji} ${p.name}</span>
          ${vals.map(v=>`<span style="color:${v>=60?'#00E396':v>=40?'#F5B942':'#FF5C8A'}">${v}</span>`).join('')}
          <span style="color:${tColor};font-weight:800">${tot}%</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ДЕДЛАЙНЫ
function deadlinesCardHTML(projects, tasks) {
  const pmap = Object.fromEntries(projects.map(p => [p.id, p]));
  const items = tasks
    .filter(t => t.project_id && !t.done && !t.cancelled && t.due_date)
    .sort((a,b) => (a.due_date||'').localeCompare(b.due_date||''))
    .slice(0, 5);
  return `<div class="card">
    <div class="sec-label">⏰ БЛИЖАЙШИЕ ДЕДЛАЙНЫ</div>
    ${items.length ? items.map(t => {
      const p = pmap[t.project_id];
      const dd = daysLabel(t.due_date);
      const urgent = /сегодня|завтра|назад|через [12] /.test(dd);
      return `<div onclick="window.openTaskDetail?.('${t.id}')" style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="font-size:16px">${p?.emoji||'📋'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.text}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.4)">${p?.name||''}</div>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:${urgent?'rgba(255,92,138,.12)':'rgba(255,255,255,.05)'};color:${urgent?'#FF5C8A':'rgba(232,237,245,.5)'}">${dd}</span>
      </div>`;
    }).join('') : '<div style="font-size:11px;color:rgba(232,237,245,.35);text-align:center;padding:16px 0">Нет задач с дедлайнами</div>'}
  </div>`;
}

// AI CEO — слабейший проект + рекомендации
function aiCeoCardHTML(projects) {
  const withGoal = projects.filter(p => p.target > 0);
  const weakest = (withGoal.length ? withGoal : projects).slice().sort((a,b)=>(a.progress||0)-(b.progress||0))[0];
  let body;
  if (!weakest) {
    body = '<div style="font-size:12px;color:rgba(232,237,245,.5)">Добавь проекты — и AI CEO подскажет, где узкое место.</div>';
  } else {
    const m = metricsFor(weakest);
    const weakArea = Object.entries({ Продажи:m.sales, Маркетинг:m.marketing, Продукт:m.product, Финансы:m.finance, Команда:m.team }).sort((a,b)=>a[1]-b[1])[0][0];
    const potential = weakest.target ? Math.round((weakest.target - weakest.current) * 0.2) : 50000;
    body = `<div style="font-size:11px;color:rgba(232,237,245,.5);margin-bottom:6px">Сегодня</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">Самый слабый проект: <span style="color:#FF5C8A">${weakest.name}</span></div>
      <div style="font-size:11px;color:rgba(232,237,245,.6);margin-bottom:10px">Причина: проседает направление «${weakArea}» (${weakest.progress}% к цели).</div>
      <div style="font-size:11px;color:#00E396;font-weight:600;margin-bottom:4px">Рекомендую:</div>
      <div style="font-size:11px;color:rgba(232,237,245,.65);line-height:1.7">1. Создать оффер для целевой аудитории<br>2. Найти 10 потенциальных клиентов<br>3. Запустить рекламу в Instagram и Telegram</div>
      <div style="font-size:11px;color:#00E396;margin-top:10px">Потенциальный рост: +${rub(potential)}</div>`;
  }
  return `<div class="card purple">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0">🤖 AI CEO</div>
    </div>
    ${body}
  </div>`;
}

// ФИНАНСОВЫЙ ОБЗОР
function financeCardHTML(projects) {
  const monthName = new Date().toLocaleDateString('ru-RU', { month:'long', year:'numeric' });
  return `<div class="card" style="margin-bottom:14px">
    <div class="sec-label">📊 ФИНАНСОВЫЙ ОБЗОР · ${monthName}</div>
    <div class="fin-grid">
      ${projects.map(p => {
        const rev = p.current || 0;
        const exp = p.expenses || 0;
        const profit = rev - exp;
        const forecast = p.target ? Math.round((rev + p.target) / 2) : Math.round(rev * 1.5);
        return `<div class="fin-col">
          <div class="row" style="gap:6px;margin-bottom:8px"><span>${p.emoji}</span><b style="font-size:12px">${p.name}</b></div>
          <div class="fin-line"><span>Выручка</span><b style="color:#00E396">${rub(rev)}</b></div>
          <div class="fin-line"><span>Расходы</span><b style="color:#FF5C8A">${exp?rub(exp):'—'}</b></div>
          <div class="fin-line"><span>Прибыль</span><b style="color:${profit>=0?'#00F5D4':'#FF5C8A'}">${rub(profit)}</b></div>
          <div class="fin-line"><span>Прогноз</span><b style="color:#7C3AED">${rub(forecast)}</b></div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function destroyRevenueChart() {}

// ── GLOBALS ───────────────────────────────────────────────────────────────────
window.openProjectDetail = function(id) {
  const p = DB.getProjects().find(x => x.id === id);
  if (!p) return;
  const div = document.createElement('div');
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div class="row" style="gap:10px;margin-bottom:16px">
      <span style="font-size:32px">${p.emoji}</span>
      <div>
        <div style="font-size:18px;font-weight:700">${p.name}</div>
        <span class="badge" style="background:${p.color}18;color:${p.color};border:1px solid ${p.color}28;margin-top:4px">${p.stage}</span>
      </div>
    </div>
    ${p.target > 0 ? `
    <div class="card" style="margin-bottom:12px">
      <div class="sec-label">💰 ФИНАНСЫ</div>
      <div class="row" style="justify-content:space-between">
        <div>
          <div class="num" style="font-size:22px;color:${p.color}">${fmt(p.current)}₽</div>
          <div style="font-size:10px;color:rgba(232,237,245,.4)">из ${fmt(p.target)}₽</div>
        </div>
        <div style="font-size:32px;font-family:'Orbitron';color:${p.color}">${p.progress}%</div>
      </div>
      <div class="prog-bar" style="height:8px">
        <div class="prog-fill" style="width:${p.progress}%;background:${p.color};box-shadow:0 0 8px ${p.color}60"></div>
      </div>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Прогресс %</div>
        <input id="proj-progress" class="input" type="number" value="${p.progress}" min="0" max="100">
      </div>
      <div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:4px">Выручка ₽</div>
        <input id="proj-current" class="input" type="number" value="${p.current}">
      </div>
    </div>
    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Статус</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
      ${['Идея','Разработка','Активно','Доставка','На паузе'].map(s=>`<button class="cat-pill${s===p.stage?' active':''}" onclick="window._projStage='${s}';document.querySelectorAll('#proj-stages .cat-pill').forEach(b=>b.classList.remove('active'));this.classList.add('active');TG.hapticSelection()" id="proj-stages" style="--cc:#00F5D4">${s}</button>`).join('')}
    </div>
    <!-- Задачи проекта -->
    ${(()=>{
      const задачи = DB.getTasks().filter(t => t.project_id === p.id);
      const active = задачи.filter(t => !t.done && !t.cancelled);
      const done   = задачи.filter(t => t.done && !t.cancelled);
      if (!задачи.length) return `<div style="font-size:11px;color:rgba(232,237,245,.3);text-align:center;padding:12px 0">Нет привязанных задач.<br>Открой задачу → выбери проект.</div>`;
      return `<div style="margin-bottom:16px">
        <div style="font-size:9px;color:rgba(232,237,245,.35);letter-spacing:.08em;margin-bottom:8px">ЗАДАЧИ (${active.length} активных · ${done.length} готовых)</div>
        ${active.slice(0,5).map(t=>`<div onclick="window.openTaskDetail?.('${t.id}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <div style="width:6px;height:6px;border-radius:50%;background:${p.color};flex-shrink:0"></div>
          <div style="flex:1;font-size:12px;color:#E8EDF5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.text}</div>
          <span style="font-size:9px;padding:2px 6px;border-radius:8px;background:rgba(255,69,96,.12);color:#FF4560">${t.quadrant==='do'?'Q1':t.quadrant==='schedule'?'Q2':'Q3'}</span>
        </div>`).join('')}
        ${done.slice(0,3).map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;opacity:.4">
          <span style="font-size:10px">✓</span>
          <div style="font-size:11px;text-decoration:line-through;color:rgba(232,237,245,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.text}</div>
        </div>`).join('')}
      </div>`;
    })()}
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <button class="btn" style="flex:1;background:rgba(0,245,212,.1);border:1px solid rgba(0,245,212,.3);color:#00F5D4"
        onclick="window.addTaskFromProject('${p.id}','${p.name.replace(/'/g,"\\'")}','${p.color}')">+ Задача</button>
      <button class="btn" style="flex:1;background:rgba(255,69,96,.08);border:1px solid rgba(255,69,96,.25);color:#FF4560"
        onclick="window.deleteProject('${p.id}')">🗑 Удалить</button>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.detail-overlay').remove()">Закрыть</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.saveProject('${p.id}')">Сохранить</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  window._projStage = p.stage;
  TG.hapticImpact('light');
};

window.deleteProject = function(id) {
  if (!confirm('Удалить проект? Задачи останутся.')) return;
  const projects = DB.getProjects().filter(x => x.id !== id);
  DB.saveProjects(projects);
  window._дбHook?.('projects', projects);
  document.querySelector('.detail-overlay')?.remove();
  renderProjects();
  TG.hapticSuccess();
};

window.addTaskFromProject = function(projectId, projectName) {
  document.querySelector('.detail-overlay')?.remove();
  // Умная модалка задачи (голос + AI авто-категория/срок) с привязкой к проекту
  window.openAddTask?.({
    project_id: projectId,
    label: 'Проект: ' + projectName,
    onClose: () => window.openProjectDetail?.(projectId),
  });
};

window.saveProject = function(id) {
  const projects = DB.getProjects();
  const p = projects.find(x => x.id === id);
  if (p) {
    p.progress = parseInt(document.getElementById('proj-progress')?.value || p.progress);
    p.current  = parseInt(document.getElementById('proj-current')?.value  || p.current);
    p.stage    = window._projStage || p.stage;
    DB.saveProjects(projects);
  }
  document.querySelector('.detail-overlay')?.remove();
  renderProjects();
  TG.hapticSuccess();
};

window.openAddProject = function() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🚀 Новый проект</div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <input id="proj-emoji" class="input" placeholder="🚀" style="width:60px;text-align:center;font-size:20px">
      <input id="proj-name" class="input" placeholder="Название проекта" style="flex:1">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <input id="proj-target-new" class="input" type="number" placeholder="Цель ₽ (0 = нет)">
      <input id="proj-color-new" class="input" type="color" value="#00F5D4" style="padding:6px">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitAddProject()">Создать 🚀</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  TG.hapticImpact('light');
};

window.submitAddProject = function() {
  const name   = document.getElementById('proj-name')?.value?.trim();
  const emoji  = document.getElementById('proj-emoji')?.value?.trim() || '🚀';
  const target = parseInt(document.getElementById('proj-target-new')?.value || '0');
  const color  = document.getElementById('proj-color-new')?.value || '#00F5D4';
  if (!name) return;
  DB.addProject({ name, emoji, target, current: 0, progress: 0, color, stage: 'Идея', tasksCount: 0 });
  document.querySelector('.modal-overlay')?.remove();
  renderProjects();
  TG.hapticSuccess();
};
