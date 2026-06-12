// ── PEOPLE / CRM SCREEN ───────────────────────────────────────────────────────
import { DB } from '../db.js?v=28';
import { TG } from '../telegram.js?v=28';

const CHECKUPS = [
  {l:'Чекап здоровья — терапевт',d:'июль 2026',i:'🏥'},
  {l:'Чекап Лёхи — ветеринар',d:'июль 2026',i:'🐕'},
  {l:'Стоматолог',d:'август 2026',i:'🦷'},
  {l:'Техосмотр / ОСАГО',d:'сентябрь 2026',i:'🚗'},
];

export function renderPeople() {
  const people = DB.getPeople();
  const urgent = people.filter(p => p.urgency === 'urgent').length;
  const expectations = DB.getExpectations().filter(e => e.status !== 'received');

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:14px">
    <div>
      <div class="num" style="font-size:16px">ЛЮДИ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${urgent} требуют внимания · ${expectations.length} ожиданий</div>
    </div>
    <button class="btn btn-teal" onclick="window.openAddPerson()">+ Контакт</button>
  </div>

  <!-- ── ОЖИДАНИЯ (жду от других) ──────────────────────────────────────────── -->
  <div class="card" style="margin-bottom:12px;border-left:3px solid #7B61FF">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div class="sec-label" style="margin:0;color:#7B61FF">🕐 ЖДАНКИ (жду от других)</div>
      <button onclick="window.openAddExpectation()" style="background:rgba(123,97,255,.12);border:1px solid rgba(123,97,255,.3);border-radius:8px;padding:4px 10px;font-size:10px;color:#7B61FF;cursor:pointer">+ Добавить</button>
    </div>
    ${expectations.length ? expectations.map(e => expectationCardHTML(e)).join('') : `
      <div style="text-align:center;padding:12px 0;font-size:11px;color:rgba(232,237,245,.3)">
        Нет активных ожиданий ✓
      </div>`}
  </div>

  <!-- ── ПЛАНОВЫЕ ЧЕКАПЫ ───────────────────────────────────────────────────── -->
  <div class="card gold" style="margin-bottom:12px">
    <div class="sec-label">📅 ПЛАНОВЫЕ ЧЕКАПЫ</div>
    ${CHECKUPS.map((c,i)=>`<div class="row" style="padding:8px 0;${i<3?'border-bottom:1px solid rgba(255,255,255,.05)':''}">
      <span style="font-size:18px;margin-right:2px">${c.i}</span>
      <div style="flex:1;padding-left:6px">
        <div style="font-size:12px;font-weight:500">${c.l}</div>
      </div>
      <span style="font-size:10px;color:#FFD700;font-weight:600">${c.d}</span>
    </div>`).join('')}
  </div>

  ${people.map(p => personCardHTML(p)).join('')}

  <div style="height:8px"></div>
</div>`;

  TG.hideBackButton();
  TG.hideMainButton();
}

// ── ОЖИДАНИЯ ─────────────────────────────────────────────────────────────────
function expectationCardHTML(e) {
  const now       = new Date();
  const deadline  = e.deadline ? new Date(e.deadline) : null;
  const diffDays  = deadline ? Math.ceil((deadline - now) / 86400000) : null;
  const overdue   = diffDays !== null && diffDays < 0;
  const urgent    = diffDays !== null && diffDays <= 1;
  const color     = overdue ? '#FF4560' : urgent ? '#FFD700' : '#7B61FF';
  const label     = overdue ? `Просрочено ${Math.abs(diffDays)}д` : diffDays === 0 ? 'Сегодня' : diffDays === 1 ? 'Завтра' : deadline ? `${diffDays}д` : '—';

  return `<div style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:flex-start;gap:10px">
    <div style="font-size:22px;flex-shrink:0;padding-top:1px">🕐</div>
    <div style="flex:1;min-width:0">
      <div class="row" style="justify-content:space-between;margin-bottom:3px">
        <div style="font-size:12px;font-weight:700;color:#E8EDF5">${e.owner}</div>
        <span style="font-size:9px;font-weight:700;color:${color};flex-shrink:0">${label}</span>
      </div>
      <div style="font-size:11px;color:rgba(232,237,245,.7);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.what}</div>
      ${e.context ? `<div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:3px">${e.context}</div>` : ''}
      ${e.trigger ? `<div style="font-size:9px;color:#FFD700;background:rgba(255,215,0,.06);border-radius:6px;padding:3px 7px;margin-top:3px">⚡ ${e.trigger}</div>` : ''}
    </div>
    <button onclick="event.stopPropagation();window.closeExpectation('${e.id}')" style="flex-shrink:0;background:rgba(0,245,212,.08);border:1px solid rgba(0,245,212,.2);border-radius:8px;padding:5px 8px;font-size:10px;color:#00F5D4;cursor:pointer">✓</button>
  </div>`;
}

window.closeExpectation = function(id) {
  DB.closeExpectation(id);
  window.showToast?.('✅ Получено!', 'success');
  renderPeople();
};

window.openAddExpectation = function() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">🕐 Жду от…</div>

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:4px">От кого жду</div>
    <input id="exp-owner" class="input" placeholder="Имя человека" style="margin-bottom:10px">

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:4px">Что именно жду</div>
    <input id="exp-what" class="input" placeholder="Результаты аналитики, ответ по КП…" style="margin-bottom:10px">

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:4px">Дедлайн ожидания</div>
    <input id="exp-deadline" class="input" type="date" style="margin-bottom:10px">

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:4px">Контекст (необязательно)</div>
    <input id="exp-context" class="input" placeholder="Он говорил что у него проблемы с X…" style="margin-bottom:10px">

    <div style="font-size:11px;color:rgba(232,237,245,.4);margin-bottom:4px">Действие если не пришло</div>
    <input id="exp-trigger" class="input" placeholder="Пингануть в Telegram в 12:00 с предложением помочь" style="margin-bottom:16px">

    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitExpectation()">Добавить ✓</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
};

window.submitExpectation = function() {
  const owner    = document.getElementById('exp-owner')?.value?.trim();
  const what     = document.getElementById('exp-what')?.value?.trim();
  const deadline = document.getElementById('exp-deadline')?.value;
  const context  = document.getElementById('exp-context')?.value?.trim();
  const trigger  = document.getElementById('exp-trigger')?.value?.trim();
  if (!owner || !what) { window.showToast?.('Заполни кто и что', 'error'); return; }
  DB.addExpectation({ owner, what, deadline: deadline || null, context, trigger });
  document.querySelector('.modal-overlay')?.remove();
  window.showToast?.('🕐 Ожидание добавлено', 'success');
  renderPeople();
};

function personCardHTML(p) {
  // §6.2 CRM urgency colors: 🔴 горит / 🟡 скоро / 🟢 позже
  const urgency = p.urgency || 'later';
  const urgencyLabel = urgency === 'urgent' ? '🔴 Горит' : urgency === 'soon' ? '🟡 Скоро' : '🟢 Позже';
  const urgencyBorderColor = urgency === 'urgent' ? '#FF4560' : urgency === 'soon' ? '#FFD700' : (p.border || 'rgba(232,237,245,.2)');
  const urgencyCardGlow    = urgency === 'urgent'
    ? 'background:rgba(255,69,96,.04);box-shadow:inset 0 0 0 1px rgba(255,69,96,.1)'
    : urgency === 'soon' ? 'background:rgba(255,215,0,.025)' : '';
  const commitStyle  = p.mine
    ? 'background:rgba(0,245,212,.05);border:1px solid rgba(0,245,212,.15)'
    : 'background:rgba(123,97,255,.05);border:1px solid rgba(123,97,255,.15)';
  const commitColor  = p.mine ? '#00F5D4' : '#7B61FF';
  const commitLabel  = p.mine ? '→ МОЁ ОБЯЗАТЕЛЬСТВО' : '← ОТ НИХ';

  return `<div class="person-card" style="border-left-color:${urgencyBorderColor};${urgencyCardGlow}" onclick="window.openPersonDetail('${p.id}')">
    <div class="row" style="gap:10px;align-items:flex-start">
      <div class="person-avatar">${p.avatar || '👤'}</div>
      <div style="flex:1">
        <div class="row" style="justify-content:space-between;margin-bottom:3px">
          <div style="font-weight:600;font-size:14px">${p.name}</div>
          <span class="badge" style="background:${urgencyBorderColor}18;color:${urgencyBorderColor};border:1px solid ${urgencyBorderColor}30;font-size:9px">${urgencyLabel}</span>
        </div>
        <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:8px">${p.rel} · контакт: ${p.last}</div>
        <div class="commitment-block" style="${commitStyle}">
          <div>
            <div style="font-size:9px;color:${commitColor};margin-bottom:2px">${commitLabel}</div>
            <div style="font-size:11px">${p.commitment}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px">
            <div style="font-size:9px;color:rgba(232,237,245,.35)">до</div>
            <div style="font-weight:700;font-size:11px;color:${p.border}">${p.due}</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ── PERSON DETAIL ─────────────────────────────────────────────────────────────
window.openPersonDetail = function(id) {
  const p = DB.getPeople().find(x => x.id === id);
  if (!p) return;

  const urgencyOpts = ['urgent','soon','later'].map(u =>
    `<button class="cat-pill${p.urgency===u?' active':''}" onclick="window._pUrgency='${u}';document.querySelectorAll('[data-urg]').forEach(b=>b.classList.remove('active'));this.classList.add('active')" data-urg="${u}" style="--cc:#00F5D4">
      ${u==='urgent'?'🔴 Сегодня':u==='soon'?'🟢 Планово':'⚪ Позже'}
    </button>`
  ).join('');

  const logItems = (p.log || []).slice(-5).reverse().map(entry =>
    `<div class="log-entry">
      <div class="log-dot"></div>
      <div>
        <div style="font-size:11px">${entry.text}</div>
        <div style="font-size:9px;color:rgba(232,237,245,.35);margin-top:2px">${entry.date}</div>
      </div>
    </div>`
  ).join('');

  const div = document.createElement('div');
  div.className = 'detail-overlay';
  div.innerHTML = `<div class="detail-sheet">
    <div class="modal-handle"></div>
    <div class="row" style="gap:10px;margin-bottom:16px">
      <div class="person-avatar" style="width:52px;height:52px;font-size:28px;border-radius:14px">${p.avatar||'👤'}</div>
      <div>
        <div style="font-size:18px;font-weight:700">${p.name}</div>
        <div style="font-size:11px;color:rgba(232,237,245,.4)">${p.rel}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px">
      <div class="sec-label">📋 ОБЯЗАТЕЛЬСТВО</div>
      <input id="p-commitment" class="input" value="${p.commitment}" style="margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:11px;color:rgba(232,237,245,.5);width:40px">До:</label>
        <input id="p-due" class="input" value="${p.due}" style="flex:1">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="p-mine" ${p.mine?'checked':''} style="accent-color:#00F5D4">
          <span style="font-size:11px;color:rgba(232,237,245,.5)">Моё</span>
        </label>
      </div>
    </div>

    <div style="margin-bottom:12px">
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Срочность</div>
      <div class="cat-pills">${urgencyOpts}</div>
    </div>

    <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:6px">Заметки</div>
    <textarea id="p-notes" class="input" rows="2" placeholder="Контекст, детали..." style="resize:none;margin-bottom:12px">${p.notes||''}</textarea>

    ${logItems ? `<div style="margin-bottom:12px">
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-bottom:8px">ИСТОРИЯ ВЗАИМОДЕЙСТВИЙ</div>
      ${logItems}
    </div>` : ''}

    <div style="display:flex;gap:6px;margin-bottom:8px">
      <input id="p-log-text" class="input" placeholder="Записать взаимодействие..." style="flex:1">
      <button class="btn btn-teal" onclick="window.addPersonLog('${p.id}')">+</button>
    </div>

    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.detail-overlay').remove()">Закрыть</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.savePerson('${p.id}')">Сохранить</button>
    </div>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  window._pUrgency = p.urgency;
  TG.hapticImpact('light');
};

window.savePerson = function(id) {
  const people = DB.getPeople();
  const p = people.find(x => x.id === id);
  if (p) {
    p.commitment = document.getElementById('p-commitment')?.value?.trim() || p.commitment;
    p.due        = document.getElementById('p-due')?.value?.trim() || p.due;
    p.mine       = document.getElementById('p-mine')?.checked ?? p.mine;
    p.notes      = document.getElementById('p-notes')?.value?.trim() || '';
    p.urgency    = window._pUrgency || p.urgency;
    DB.savePeople(people);
  }
  document.querySelector('.detail-overlay')?.remove();
  renderPeople();
  TG.hapticSuccess();
};

window.addPersonLog = function(id) {
  const text = document.getElementById('p-log-text')?.value?.trim();
  if (!text) return;
  const people = DB.getPeople();
  const p = people.find(x => x.id === id);
  if (p) {
    if (!p.log) p.log = [];
    p.log.push({ text, date: new Date().toLocaleDateString('ru-RU') });
    p.last = 'сегодня';
    DB.savePeople(people);
    document.getElementById('p-log-text').value = '';
    TG.hapticSuccess();
    // Re-open to refresh
    document.querySelector('.detail-overlay')?.remove();
    window.openPersonDetail(id);
  }
};

window.openAddPerson = function() {
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.innerHTML = `<div class="modal-sheet">
    <div class="modal-handle"></div>
    <div class="modal-title">👤 Новый контакт</div>
    <input id="new-p-name" class="input" placeholder="Имя" style="margin-bottom:10px">
    <input id="new-p-rel"  class="input" placeholder="Отношение (напр. Партнёр 🤝)" style="margin-bottom:10px">
    <input id="new-p-commitment" class="input" placeholder="Обязательство или следующий шаг" style="margin-bottom:10px">
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <input id="new-p-due" class="input" placeholder="Срок" style="flex:1">
      <select id="new-p-urgency" class="input" style="flex:1">
        <option value="later">Позже</option>
        <option value="soon">Скоро</option>
        <option value="urgent">Сегодня</option>
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
      <button class="btn btn-teal" style="flex:2" onclick="window.submitAddPerson()">Добавить</button>
    </div>
  </div>`;
  div.addEventListener('click', e => { if (e.target === div) div.remove(); });
  document.body.appendChild(div);
  TG.hapticImpact('light');
};

window.submitAddPerson = function() {
  const name       = document.getElementById('new-p-name')?.value?.trim();
  if (!name) return;
  const rel        = document.getElementById('new-p-rel')?.value?.trim() || 'Контакт';
  const commitment = document.getElementById('new-p-commitment')?.value?.trim() || '—';
  const due        = document.getElementById('new-p-due')?.value?.trim() || '—';
  const urgency    = document.getElementById('new-p-urgency')?.value || 'later';
  const BORDERS    = { urgent:'#FF4560', soon:'#00F5D4', later:'rgba(232,237,245,.2)' };
  DB.addPerson({ name, rel, commitment, mine:true, due, urgency, border: BORDERS[urgency], avatar:'👤', last:'сегодня', notes:'' });
  document.querySelector('.modal-overlay')?.remove();
  renderPeople();
  TG.hapticSuccess();
};
