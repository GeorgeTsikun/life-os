// ── PROJECTS SCREEN ───────────────────────────────────────────────────────────
import { DB } from '../db.js?v=39';
import { TG } from '../telegram.js?v=39';

let revenueChart;

function fmt(v) {
  if (v >= 1000000) return `${(v/1000000).toFixed(1)}М`;
  if (v >= 1000)    return `${Math.round(v/1000)}К`;
  return v;
}

export function renderProjects() {
  const projects = DB.getProjects();
  const totalCurrent = projects.reduce((s,p) => s + (p.current||0), 0);

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:14px">
    <div>
      <div class="num" style="font-size:16px">ПРОЕКТЫ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${projects.length} активных · цель 1М₽/мес</div>
    </div>
    <div style="text-align:right">
      <div class="num" style="font-size:18px;color:#00F5D4">${fmt(totalCurrent)}₽</div>
      <div style="font-size:9px;color:rgba(232,237,245,.4)">текущий месяц</div>
    </div>
  </div>

  <div class="card" style="margin-bottom:12px">
    <div class="sec-label">📈 ВЫРУЧКА / МЕС</div>
    <div style="height:100px"><canvas id="revenue-chart"></canvas></div>
    <div class="grid3" style="margin-top:10px">
      ${[
        {l:'MoM рост',v:'+29%',c:'#00E396'},
        {l:'До цели',v:`-${fmt(1000000-totalCurrent)}₽`,c:'#FFD700'},
        {l:'Прогноз',v:'640К₽',c:'#7B61FF'},
      ].map(s=>`<div style="text-align:center">
        <div style="font-size:9px;color:rgba(232,237,245,.35);margin-bottom:3px">${s.l}</div>
        <div style="font-weight:700;font-size:13px;color:${s.c}">${s.v}</div>
      </div>`).join('')}
    </div>
  </div>

  ${projects.map(p => projectCardHTML(p)).join('')}

  <button class="btn btn-teal" style="width:100%;padding:12px;margin-bottom:12px" onclick="window.openAddProject()">
    + Новый проект
  </button>

  <div style="height:8px"></div>
</div>`;

  requestAnimationFrame(() => {
    destroyRevenueChart();
    const rc = document.getElementById('revenue-chart');
    if (rc) {
      revenueChart = new Chart(rc, {
        type: 'line',
        data: {
          labels: ['Апр','Май','Июн','Прогн.'],
          datasets: [{
            data: [280000,380000,totalCurrent,640000],
            borderColor: '#00F5D4',
            borderWidth: 2,
            backgroundColor: 'rgba(0,245,212,.1)',
            fill: true,
            tension: .4,
            pointBackgroundColor: (_,i) => i.dataIndex === 3 ? 'rgba(0,245,212,.5)' : '#00F5D4',
            pointRadius: [0,0,4,4],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: v => `${fmt(v.raw)}₽` } },
          },
          scales: {
            x: { grid:{display:false}, ticks:{color:'rgba(232,237,245,.4)',font:{size:10}} },
            y: { display: false },
          },
        },
      });
    }
  });

  TG.hideBackButton();
  TG.hideMainButton();
}

function projectCardHTML(p) {
  const задачиПроекта = DB.getTasks().filter(t => t.project_id === p.id && !t.done && !t.cancelled);
  const realCount     = задачиПроекта.length;
  const topTask       = задачиПроекта.find(t => t.quadrant === 'do') || задачиПроекта[0];

  return `<div class="project-card" onclick="window.openProjectDetail('${p.id}')">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="row" style="gap:8px">
        <span style="font-size:24px">${p.emoji}</span>
        <div>
          <div style="font-weight:600;font-size:14px">${p.name}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.4);margin-top:1px">
            ${realCount > 0 ? `${realCount} активных задач` : 'Нет задач'}
          </div>
        </div>
      </div>
      <div style="text-align:right">
        <span class="badge" style="background:${p.color}18;color:${p.color};border:1px solid ${p.color}28">${p.stage}</span>
        ${p.target > 0 ? `<div class="num" style="font-size:15px;color:${p.color};margin-top:4px">${fmt(p.current)}₽</div>` : ''}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
      <span style="font-size:10px;color:rgba(232,237,245,.4)">Прогресс</span>
      ${p.target > 0 ? `<span style="font-size:10px;color:rgba(232,237,245,.4)">цель ${fmt(p.target)}₽</span>` : ''}
    </div>
    <div class="prog-bar">
      <div class="prog-fill" style="width:${p.progress}%;background:${p.color};box-shadow:0 0 8px ${p.color}80"></div>
    </div>
    <div class="num" style="font-size:12px;color:${p.color};margin-top:4px">${p.progress}%</div>
    ${topTask ? `<div style="margin-top:8px;padding:7px 10px;background:rgba(255,255,255,.03);border-radius:8px;border-left:2px solid ${p.color}60;display:flex;align-items:center;gap:8px">
      <span style="font-size:10px">⚡</span>
      <div style="font-size:11px;color:rgba(232,237,245,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${topTask.text}</div>
    </div>` : ''}
  </div>`;
}

function destroyRevenueChart() {
  if (revenueChart) { try { revenueChart.destroy(); } catch {} revenueChart = null; }
}

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

window.addTaskFromProject = function(projectId, projectName, projectColor) {
  document.querySelector('.detail-overlay')?.remove();
  const div = document.createElement('div');
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div style="font-size:14px;font-weight:700;margin-bottom:12px">+ Задача в проект: ${projectName}</div>
    <input id="projtask-text" class="input" placeholder="Что сделать..." style="margin-bottom:10px" autofocus>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <select id="projtask-quad" class="input" style="flex:1">
        <option value="do">⚡ Q1 Срочно</option>
        <option value="schedule" selected>🏔️ Q2 Важно</option>
      </select>
      <input id="projtask-due" class="input" type="date" style="flex:1" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.detail-overlay').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window._saveTaskFromProject('${projectId}','${projectName.replace(/'/g,"\\'")}')">Создать</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('projtask-text')?.focus(), 100);
};

window._saveTaskFromProject = function(projectId, projectName) {
  const text = document.getElementById('projtask-text')?.value?.trim();
  if (!text) return;
  const quad = document.getElementById('projtask-quad')?.value || 'schedule';
  const due  = document.getElementById('projtask-due')?.value || null;
  DB.addTask({ text, cat: 'Работа', quadrant: quad, due_date: due, project_id: projectId });
  document.querySelector('.detail-overlay')?.remove();
  window.showToast?.('✅', 'Задача создана', text, '');
  TG.hapticSuccess();
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
