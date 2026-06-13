// ── VOICE CAPTURE — глобальный голосовой захват с любого экрана ───────────────
// Открывается по FAB с любой вкладки. После транскрипции → задача / инбокс / заметка.

import { DB } from './db.js?v=39';
import { TG } from './telegram.js?v=39';

let _vcRecording = null; // { recorder, timer, chunks }

export function openVoiceCapture(onDone) {
  document.getElementById('vc-modal')?.remove();

  const div = document.createElement('div');
  div.id = 'vc-modal';
  div.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    display:flex;align-items:flex-end;justify-content:center;
    background:rgba(0,0,0,.6);backdrop-filter:blur(6px);
    animation:fadeIn .2s ease
  `;

  div.innerHTML = `
  <div id="vc-sheet" style="
    background:linear-gradient(180deg,#0d1f3c,#03030A);
    border-radius:24px 24px 0 0;
    padding:20px 20px 40px;
    width:100%;max-width:420px;
    border-top:1px solid rgba(0,245,212,.15);
    animation:slideUp .25s ease
  ">
    <div style="width:36px;height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:0 auto 20px"></div>

    <!-- Большая кнопка микрофона -->
    <div style="text-align:center;margin-bottom:20px">
      <button id="vc-mic-btn" onclick="window.vcToggleRec()" style="
        width:84px;height:84px;border-radius:50%;border:none;cursor:pointer;
        background:linear-gradient(135deg,#FF4560,#FF6B6B);
        font-size:36px;color:#fff;
        box-shadow:0 0 32px rgba(255,69,96,.5);
        transition:all .2s ease
      ">🎙️</button>
      <div id="vc-timer" style="font-family:'Orbitron',monospace;font-size:22px;color:#FF4560;margin-top:10px;min-height:28px;font-weight:700"></div>
      <div id="vc-hint" style="font-size:12px;color:rgba(232,237,245,.5);margin-top:4px;min-height:18px">Нажми и говори</div>
    </div>

    <!-- Прогресс / результат -->
    <div id="vc-result" style="display:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:14px">
      <div style="font-size:11px;color:rgba(232,237,245,.35);margin-bottom:4px">Распознано:</div>
      <div id="vc-text" style="font-size:13px;color:#E8EDF5;line-height:1.5"></div>
    </div>

    <!-- Кнопки действий (показываются после транскрипции) -->
    <div id="vc-actions" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <button onclick="window.vcSaveTask()" style="
        padding:12px 8px;border-radius:12px;border:1px solid rgba(0,245,212,.3);
        background:rgba(0,245,212,.08);color:#00F5D4;font-size:12px;font-weight:700;cursor:pointer
      ">✅ Задача</button>
      <button onclick="window.vcSaveInbox()" style="
        padding:12px 8px;border-radius:12px;border:1px solid rgba(123,97,255,.3);
        background:rgba(123,97,255,.08);color:#7B61FF;font-size:12px;font-weight:700;cursor:pointer
      ">💡 В инбокс</button>
    </div>
    <div id="vc-actions" style="display:none"></div>

    <button onclick="window.vcClose()" style="
      width:100%;padding:11px;border-radius:12px;border:1px solid rgba(255,255,255,.1);
      background:rgba(255,255,255,.04);color:rgba(232,237,245,.4);font-size:12px;cursor:pointer
    ">Закрыть</button>
  </div>`;

  div.addEventListener('click', e => { if (e.target === div) window.vcClose(); });
  document.body.appendChild(div);

  TG.hapticImpact('medium');

  // Сразу стартуем запись
  setTimeout(() => window.vcStartRec(), 150);

  window._vcOnDone = onDone;
}

// ── ЗАПИСЬ ────────────────────────────────────────────────────────────────────
window.vcToggleRec = async function() {
  if (_vcRecording?.recorder?.state === 'recording') {
    _vcRecording.recorder.stop();
    if (_vcRecording.timer) clearInterval(_vcRecording.timer);
    document.getElementById('vc-mic-btn').textContent = '⏳';
    document.getElementById('vc-hint').textContent = 'Распознаю речь…';
    document.getElementById('vc-timer').textContent = '';
  } else {
    await window.vcStartRec();
  }
};

window.vcStartRec = async function() {
  const btn  = document.getElementById('vc-mic-btn');
  const hint = document.getElementById('vc-hint');
  if (!btn) return;

  try {
    const поток = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    const recorder = new MediaRecorder(поток, { mimeType });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      поток.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mimeType });
      await vcTranscribe(blob, mimeType);
    };
    recorder.start();

    let секунды = 0;
    const timer = setInterval(() => {
      секунды++;
      if (!document.getElementById('vc-modal')) { clearInterval(timer); return; }
      const m = String(Math.floor(секунды / 60)).padStart(2, '0');
      const s = String(секунды % 60).padStart(2, '0');
      const el = document.getElementById('vc-timer');
      if (el) el.textContent = `${m}:${s}`;
    }, 1000);

    _vcRecording = { recorder, timer, chunks };
    btn.textContent = '⏹';
    btn.style.animation = 'pulseRec 1.2s ease-in-out infinite';
    hint.textContent = 'Идёт запись… Нажми ⏹ чтобы остановить';
    TG.hapticImpact('light');
  } catch (err) {
    hint.textContent = '❌ Нет доступа к микрофону';
  }
};

async function vcTranscribe(blob, mimeType) {
  const hint = document.getElementById('vc-hint');
  const btn  = document.getElementById('vc-mic-btn');
  if (btn) { btn.textContent = '⏳'; btn.style.animation = 'none'; }

  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    if (!res.ok) throw new Error('Whisper error');
    const { text } = await res.json();

    // Показываем текст
    const resultDiv = document.getElementById('vc-result');
    const textDiv   = document.getElementById('vc-text');
    const actDiv    = document.querySelectorAll('#vc-actions');
    if (resultDiv) { resultDiv.style.display = 'block'; }
    if (textDiv)   { textDiv.textContent = text; }
    actDiv.forEach(a => a.style.display = 'grid');
    if (hint) hint.textContent = 'Готово! Куда сохранить?';
    if (btn) btn.textContent = '✓';

    window._vcText = text;
    TG.hapticSuccess();

    // Автоматически запускаем AI-классификацию в фоне
    vcClassifyInBackground(text);
  } catch (err) {
    if (hint) hint.textContent = `❌ ${err.message}`;
    if (btn) { btn.textContent = '🎙️'; btn.style.animation = 'none'; }
  }
}

let _vcClassified = null;
async function vcClassifyInBackground(text) {
  try {
    const res = await fetch('/api/classify-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ текст: text }),
    });
    if (res.ok) _vcClassified = await res.json();
  } catch {}
}

// ── ДЕЙСТВИЯ ПОСЛЕ ТРАНСКРИПЦИИ ──────────────────────────────────────────────
window.vcSaveTask = function() {
  const text = window._vcText;
  if (!text) return;
  window.vcClose();

  // Открываем add-task modal с предзаполненным текстом
  // Переходим на вкладку задач если нужно
  if (window.openAddTask) {
    // Переключаем на tasks если не там
    if (window._текущийТаб !== 'tasks') {
      window.goTab?.(null, 'tasks');
    }
    setTimeout(() => {
      window.openAddTask();
      setTimeout(() => {
        const inp = document.getElementById('task-input');
        if (inp) inp.value = text;
        // Если успели классифицировать — применяем
        if (_vcClassified) {
          if (_vcClassified.cat)      window.addPickCat?.(_vcClassified.cat);
          if (_vcClassified.quadrant) window.addPickQuad?.(_vcClassified.quadrant);
          if (_vcClassified.time) {
            const btn = document.querySelector(`#add-dates [data-date="${CSS.escape(_vcClassified.time)}"]`);
            if (btn) window.addPickDate?.(btn, _vcClassified.time);
            else {
              const custom = document.getElementById('task-time-custom');
              if (custom) { custom.value = _vcClassified.time; }
              if (window._addState) window._addState.time = _vcClassified.time;
            }
          }
          const hint = document.getElementById('add-mic-hint');
          if (hint && _vcClassified.cat) hint.textContent = `✓ AI: ${_vcClassified.cat} · ${_vcClassified.quadrant || '?'}`;
        }
        _vcClassified = null;
        window._vcText = null;
      }, 100);
    }, 50);
  }
};

window.vcSaveInbox = async function() {
  const text = window._vcText;
  if (!text) return;
  window.vcClose();

  // Сохраняем в инбокс
  const entry = {
    id: 'vc_' + Date.now(),
    type: 'idea',
    text,
    created_at: new Date().toISOString(),
  };
  const inbox = DB.getInbox();
  inbox.unshift(entry);
  DB.saveInbox(inbox);

  window.showToast?.('💡 Сохранено в инбокс', 'success');
  TG.hapticSuccess();
  _vcClassified = null;
  window._vcText = null;

  // Обновляем дашборд если он открыт
  if (window._текущийТаб === 'dash') {
    window.ЭКРАНЫ?.dash?.();
  }
};

window.vcClose = function() {
  if (_vcRecording?.recorder?.state === 'recording') {
    _vcRecording.recorder.stop();
    if (_vcRecording.timer) clearInterval(_vcRecording.timer);
  }
  _vcRecording = null;
  _vcClassified = null;
  window._vcText = null;
  document.getElementById('vc-modal')?.remove();
  TG.hapticImpact('light');
};
