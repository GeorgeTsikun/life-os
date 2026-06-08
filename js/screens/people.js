// ── PEOPLE / CRM SCREEN ───────────────────────────────────────────────────────
import { DB } from '../db.js';
import { TG } from '../telegram.js';

const CHECKUPS = [
  {l:'Чекап здоровья — терапевт',d:'июль 2026',i:'🏥'},
  {l:'Чекап Лёхи — ветеринар',d:'июль 2026',i:'🐕'},
  {l:'Стоматолог',d:'август 2026',i:'🦷'},
  {l:'Техосмотр / ОСАГО',d:'сентябрь 2026',i:'🚗'},
];

export function renderPeople() {
  const people = DB.getPeople();
  const urgent = people.filter(p => p.urgency === 'urgent').length;

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen">
  <div class="row" style="justify-content:space-between;margin-bottom:14px">
    <div>
      <div class="num" style="font-size:16px">ЛЮДИ</div>
      <div style="font-size:10px;color:rgba(232,237,245,.4);margin-top:2px">${urgent} требуют внимания сегодня</div>
    </div>
    <button class="btn btn-teal" onclick="window.openAddPerson()">+ Контакт</button>
  </div>

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

function personCardHTML(p) {
  const urgencyLabel = p.urgency === 'urgent' ? '🔴 Сегодня' : p.urgency === 'soon' ? '🟢 Планово' : '⚪ Позже';
  const commitStyle  = p.mine
    ? 'background:rgba(0,245,212,.05);border:1px solid rgba(0,245,212,.15)'
    : 'background:rgba(123,97,255,.05);border:1px solid rgba(123,97,255,.15)';
  const commitColor  = p.mine ? '#00F5D4' : '#7B61FF';
  const commitLabel  = p.mine ? '→ МОЁ ОБЯЗАТЕЛЬСТВО' : '← ОТ НИХ';

  return `<div class="person-card" style="border-left-color:${p.border}" onclick="window.openPersonDetail('${p.id}')">
    <div class="row" style="gap:10px;align-items:flex-start">
      <div class="person-avatar">${p.avatar || '👤'}</div>
      <div style="flex:1">
        <div class="row" style="justify-content:space-between;margin-bottom:3px">
          <div style="font-weight:600;font-size:14px">${p.name}</div>
          <span class="badge" style="background:${p.border}18;color:${p.border};border:1px solid ${p.border}30;font-size:9px">${urgencyLabel}</span>
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
