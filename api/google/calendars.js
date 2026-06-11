// ── /api/google/calendars — UI для маппинга категорий на твои календари ─────

import { listCalendars, loadMapping } from '../_lib/google.js';

const КАТЕГОРИИ = [
  { id:'Работа',       emoji:'💎', цвет:'#00F5D4' },
  { id:'Контент',      emoji:'📱', цвет:'#FF9F43' },
  { id:'Эксперименты', emoji:'🧪', цвет:'#7B61FF' },
  { id:'Семья',        emoji:'❤️', цвет:'#FF6B6B' },
  { id:'Встречи',      emoji:'🤝', цвет:'#00C9FF' },
  { id:'Быт',          emoji:'🍱', цвет:'#FFD700' },
  { id:'Стратегия',    emoji:'🎯', цвет:'#00E396' },
  { id:'Обучение',     emoji:'📖', цвет:'#FFD58A' },
  { id:'Деньги',       emoji:'💰', цвет:'#FFD700' },
  { id:'Здоровье',     emoji:'🏃', цвет:'#FF6B6B' },
  { id:'Chill',        emoji:'🌴', цвет:'#7B61FF' },
];

export default async function handler(req, res) {
  try {
    const [calendars, mapping] = await Promise.all([
      listCalendars(),
      loadMapping(),
    ]);

    const options = calendars
      .filter(c => c.accessRole === 'owner' || c.accessRole === 'writer')
      .map(c => `<option value="${c.id}" data-color="${c.backgroundColor || ''}" data-name="${escapeHtml(c.summary)}">${escapeHtml(c.summary)}${c.primary ? ' (основной)' : ''}</option>`)
      .join('');

    const строки = КАТЕГОРИИ.map(cat => {
      const текущий = mapping[cat.id]?.calendar_id || '';
      return `
        <div class="row">
          <div class="cat">
            <span class="emoji">${cat.emoji}</span>
            <span class="name" style="color:${cat.цвет}">${cat.id}</span>
          </div>
          <select name="${cat.id}" data-cat="${cat.id}">
            <option value="">— не привязано —</option>
            ${options.replace(`value="${текущий}"`, `value="${текущий}" selected`)}
          </select>
        </div>
      `;
    }).join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Маппинг календарей</title>
  <style>
    * { box-sizing:border-box }
    body { background:#03030A; color:#E8EDF5; font-family:'Manrope',sans-serif; padding:40px 20px; max-width:540px; margin:0 auto }
    h1 { font-family:'Orbitron',sans-serif; font-size:20px; color:#00F5D4; margin:0 0 8px }
    .sub { color:rgba(232,237,245,.5); font-size:13px; margin-bottom:24px; line-height:1.5 }
    .row { display:flex; gap:10px; align-items:center; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.06) }
    .cat { flex:1; display:flex; gap:8px; align-items:center }
    .emoji { font-size:18px }
    .name { font-weight:600; font-size:13px; letter-spacing:.02em }
    select { flex:1; background:#0D0D1A; color:#E8EDF5; border:1px solid rgba(255,255,255,.1); border-radius:6px; padding:8px; font-size:12px; font-family:inherit }
    .btn { display:block; width:100%; background:linear-gradient(135deg,#00F5D4,#7B61FF); color:#000; padding:14px; border-radius:10px; border:none; font-weight:700; font-size:14px; cursor:pointer; margin-top:24px }
    .ok { background:rgba(0,245,212,.1); border:1px solid rgba(0,245,212,.3); border-radius:8px; padding:10px; margin-top:14px; color:#00F5D4; font-size:12px; display:none }
    .err { background:rgba(255,69,96,.1); border:1px solid rgba(255,69,96,.3); border-radius:8px; padding:10px; margin-top:14px; color:#FF4560; font-size:12px; display:none }
  </style>
</head>
<body>
  <h1>📅 МАППИНГ КАТЕГОРИЙ → КАЛЕНДАРИ</h1>
  <div class="sub">
    Выбери в какой Google Calendar бот будет класть события для каждой категории задач.
    Можешь оставить какие-то незаполненными — для них события создаваться не будут.
  </div>
  <form id="form">
    ${строки}
    <button type="submit" class="btn">💾 Сохранить</button>
    <div id="ok" class="ok">✓ Сохранено! Теперь бот будет создавать события автоматически.</div>
    <div id="err" class="err"></div>
  </form>
  <script>
    document.getElementById('form').onsubmit = async (e) => {
      e.preventDefault();
      const ok = document.getElementById('ok');
      const err = document.getElementById('err');
      ok.style.display = 'none'; err.style.display = 'none';
      const маппинг = {};
      document.querySelectorAll('select[data-cat]').forEach(s => {
        if (s.value) {
          const opt = s.options[s.selectedIndex];
          маппинг[s.dataset.cat] = {
            calendar_id: s.value,
            calendar_name: opt.dataset.name,
            color: opt.dataset.color,
          };
        }
      });
      try {
        const res = await fetch('/api/google/save-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mapping: маппинг }),
        });
        if (!res.ok) throw new Error((await res.json()).error || res.statusText);
        ok.style.display = 'block';
      } catch (e) {
        err.textContent = '❌ ' + e.message;
        err.style.display = 'block';
      }
    };
  </script>
</body>
</html>`);
  } catch (err) {
    console.error('calendars error:', err);
    res.status(500).send(`<html><body style="background:#03030A;color:#E8EDF5;font-family:sans-serif;padding:40px">
      <h1 style="color:#FF4560">⚠️ Ошибка</h1>
      <p>${escapeHtml(err.message)}</p>
      <p><a href="/api/google/auth" style="color:#00F5D4">→ Пройти OAuth заново</a></p>
    </body></html>`);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
