// ── ЭКРАН ОНБОРДИНГА: голосовое заполнение всей системы ──────────────────────
import { DB } from '../db.js?v=53';

const БЛОКИ = [
  {
    key: 'about',
    icon: '👤',
    title: 'Я и моя жизнь',
    prompt: 'Расскажи кто ты — имя, возраст, чем занимаешься, где живёшь, какой у тебя текущий статус. 1–2 минуты.',
    hint: 'Пример: «Меня зовут Джордж, 27 лет, строю империю из 4 проектов, живу в Москве…»',
  },
  {
    key: 'projects',
    icon: '🚀',
    title: 'Мои направления и проекты',
    prompt: 'Перечисли ВСЕ свои проекты, бизнесы, направления. Для каждого — название, на каком этапе, цель по деньгам если есть.',
    hint: 'Пример: «ИИЗИ-клуб — активный, 310К в месяц, цель 500К. VAIB — разработка платформы агентов…»',
  },
  {
    key: 'health',
    icon: '💪',
    title: 'Здоровье и тело',
    prompt: 'Рост, вес, привычки, спорт, сон, питание. Что отслеживаешь, что хочешь улучшить, есть ли проблемы.',
    hint: 'Пример: «Сплю 7-8 часов, тренажёрка 3 раза в неделю, пью БАДы для СДВГ…»',
  },
  {
    key: 'hrv_baseline',
    icon: '❤️',
    title: 'Калибровка HRV',
    type: 'hrv',
    prompt: 'Введи свой средний HRV (вариабельность сердечного ритма) из Apple Watch, Garmin или другого устройства. Это нужно для расчёта твоей реальной ёмкости (RC) и бонусов за сверхусилие.',
    hint: 'Норма: 40–100 мс. Если не знаешь — введи 60. Потом сможешь изменить в настройках здоровья.',
  },
  {
    key: 'people',
    icon: '👥',
    title: 'Люди в моей жизни',
    prompt: 'Партнёр, семья, друзья, ключевые контакты в бизнесе. У кого с чем сейчас, кто кому что должен.',
    hint: 'Пример: «Партнёр Таня, мама Маргарита, CTO Дима должен прислать архитектуру до пятницы…»',
  },
  {
    key: 'money',
    icon: '💰',
    title: 'Финансы и цели',
    prompt: 'Сколько зарабатываешь сейчас, какие источники дохода, цель на месяц/квартал/год.',
    hint: 'Пример: «Сейчас 490К/мес, цель 1М/мес, основной доход — клуб и консалтинг…»',
  },
  {
    key: 'rhythm',
    icon: '⏰',
    title: 'Время и ритм',
    prompt: 'Во сколько встаёшь, когда пик энергии, основные привычки, утренние и вечерние ритуалы.',
    hint: 'Пример: «Встаю в 6:30, пик в среду и пятницу, утром — холодный душ, БАДы, тренировка…»',
  },
  {
    key: 'patterns',
    icon: '🎯',
    title: 'Что бесит и что бодрит',
    prompt: 'Антипаттерны (что у тебя ворует время), ловушки (от чего хочешь избавиться), что тебя реально драйвит.',
    hint: 'Пример: «Бесит скролл новостей, встречи без результата. Драйвит создание систем, общение с командой…»',
  },
];

let текущийБлок = 0;
let ответы = {};
let рекордер = null;
let аудиоЧанки = [];
let поток = null;
let таймер = null;
let секунды = 0;
let последняяЗапись = null;          // последний blob — для скачивания/повтора
let последнийМимТип = 'audio/webm';

// ── IndexedDB — постоянное хранилище аудиозаписей ────────────────────────────
// Запись сохраняется СРАЗУ → доступна даже после перезагрузки/крэша браузера
async function открытьБД() {
  return new Promise((resolve, reject) => {
    const запрос = indexedDB.open('lifeos-recordings', 1);
    запрос.onupgradeneeded = () => {
      const бд = запрос.result;
      if (!бд.objectStoreNames.contains('recordings')) {
        бд.createObjectStore('recordings', { keyPath: 'key' });
      }
    };
    запрос.onsuccess = () => resolve(запрос.result);
    запрос.onerror = () => reject(запрос.error);
  });
}

async function сохранитьАудио(ключ, blob, mimeType) {
  try {
    const бд = await открытьБД();
    const tx = бд.transaction('recordings', 'readwrite');
    tx.objectStore('recordings').put({
      key:       ключ,
      blob,
      mimeType,
      savedAt:   new Date().toISOString(),
      sizeMb:    +(blob.size / 1024 / 1024).toFixed(2),
    });
    return new Promise(res => { tx.oncomplete = () => res(true); tx.onerror = () => res(false); });
  } catch { return false; }
}

async function загрузитьАудио(ключ) {
  try {
    const бд = await открытьБД();
    return new Promise((resolve) => {
      const зап = бд.transaction('recordings').objectStore('recordings').get(ключ);
      зап.onsuccess = () => resolve(зап.result || null);
      зап.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function удалитьАудио(ключ) {
  try {
    const бд = await открытьБД();
    бд.transaction('recordings', 'readwrite').objectStore('recordings').delete(ключ);
  } catch {}
}

async function списокАудио() {
  try {
    const бд = await открытьБД();
    return new Promise((resolve) => {
      const зап = бд.transaction('recordings').objectStore('recordings').getAll();
      зап.onsuccess = () => resolve(зап.result || []);
      зап.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export async function renderOnboarding() {
  const блок = БЛОКИ[текущийБлок];
  const прогресс = Math.round(((текущийБлок) / БЛОКИ.length) * 100);
  const ответ = ответы[блок.key];
  const сохранёнка = ответ ? null : await загрузитьАудио(блок.key);

  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen onboarding-screen">

    <div style="text-align:center;margin-bottom:20px">
      <div style="font-family:'Orbitron';font-size:14px;color:#00F5D4;letter-spacing:.15em">LIFE OS · НАСТРОЙКА</div>
      <div style="font-size:11px;color:rgba(232,237,245,.4);margin-top:4px">Шаг ${текущийБлок+1} из ${БЛОКИ.length}</div>
    </div>

    <div class="xp-bar" style="margin-bottom:24px">
      <div class="xp-fill" style="width:${прогресс}%"></div>
    </div>

    <div style="text-align:center;margin-bottom:18px">
      <div style="font-size:48px;margin-bottom:8px">${блок.icon}</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:6px">${блок.title}</div>
      <div style="font-size:13px;color:rgba(232,237,245,.65);line-height:1.5;padding:0 8px">${блок.prompt}</div>
    </div>

    <div style="background:rgba(0,245,212,.04);border:1px solid rgba(0,245,212,.12);border-radius:10px;padding:10px 12px;margin-bottom:20px">
      <div style="font-size:10px;color:#00F5D4;letter-spacing:.05em;margin-bottom:4px">ПОДСКАЗКА</div>
      <div style="font-size:11px;color:rgba(232,237,245,.55);line-height:1.5;font-style:italic">${блок.hint}</div>
    </div>

    <div id="rec-area">
      ${блок.type === 'hrv' ? (_hrvVal = parseInt(ответы['hrv_baseline'] || 60), renderHRVInput()) : (ответ ? renderОтвет(ответ) : renderКнопкаЗаписи())}
    </div>

    ${сохранёнка ? `<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:10px 12px;margin-top:14px">
      <div style="font-size:10px;color:#FFD700;letter-spacing:.05em;margin-bottom:4px">💾 ЕСТЬ СОХРАНЁННАЯ ЗАПИСЬ</div>
      <div style="font-size:11px;color:rgba(232,237,245,.6);margin-bottom:10px">
        ${сохранёнка.sizeMb} МБ · ${new Date(сохранёнка.savedAt).toLocaleString('ru-RU')}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-teal"  style="flex:1;font-size:10px" onclick="window.onbВосстановить()">↻ Расшифровать снова</button>
        <button class="btn btn-ghost" style="flex:1;font-size:10px" onclick="window.onbСкачатьСохранённую()">⬇️ Скачать</button>
        <button class="btn btn-ghost" style="font-size:10px"        onclick="window.onbУдалитьСохранённую()">🗑</button>
      </div>
    </div>` : ''}

    ${!ответ && блок.type !== 'hrv' ? `<div style="margin-top:14px">
      <details style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px">
        <summary style="cursor:pointer;font-size:12px;color:rgba(232,237,245,.7)">✍️ Или вставь текстом</summary>
        <textarea id="manual-text" class="input" rows="4" placeholder="Напиши текстом если так удобнее..." style="margin-top:10px;resize:vertical"></textarea>
        <button class="btn btn-teal" style="width:100%;margin-top:8px" onclick="window.onbСохранитьТекст()">Сохранить и далее →</button>
      </details>
    </div>` : ''}

    <div style="display:flex;gap:8px;margin-top:16px">
      ${текущийБлок > 0
        ? `<button class="btn btn-ghost" style="flex:1" onclick="window.onbПрев()">← Назад</button>`
        : ''}
      ${(ответ || блок.type === 'hrv')
        ? `<button class="btn btn-teal" style="flex:2" onclick="window.onbДалее()">${текущийБлок === БЛОКИ.length-1 ? '🚀 Создать мою ОС' : 'Далее →'}</button>`
        : `<button class="btn btn-ghost" style="flex:2" onclick="window.onbПропустить()">Пропустить блок</button>`}
    </div>

    <button class="btn btn-ghost" style="width:100%;margin-top:20px;opacity:.5;font-size:10px" onclick="window.onbОтмена()">
      Заполнить вручную (без AI)
    </button>

  </div>`;
}

function renderHRVInput() {
  const saved = ответы['hrv_baseline'];
  const val = saved ? parseInt(saved) : 60;
  return `<div style="padding:10px 0">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:13px;color:rgba(232,237,245,.6);margin-bottom:12px">Мой средний HRV</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px">
        <button onclick="window.onbHRVChange(-5)"
          style="width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.15);
                 background:rgba(255,255,255,.06);color:#E8EDF5;font-size:20px;cursor:pointer">−</button>
        <div style="text-align:center">
          <div id="hrv-display" class="num" style="font-size:42px;color:#FF4560;font-family:Orbitron;min-width:80px">${val}</div>
          <div style="font-size:10px;color:rgba(232,237,245,.35);margin-top:2px">мс</div>
        </div>
        <button onclick="window.onbHRVChange(+5)"
          style="width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.15);
                 background:rgba(255,255,255,.06);color:#E8EDF5;font-size:20px;cursor:pointer">+</button>
      </div>
      <input type="range" id="hrv-slider" min="20" max="120" value="${val}" step="1"
        oninput="window.onbHRVSlide(this.value)"
        style="width:100%;margin-top:16px;accent-color:#FF4560">
    </div>
    <div id="hrv-zone" style="text-align:center;margin-top:8px">${hrvZoneHTML(val)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:14px">
      ${[['Низкий','< 40','#FF4560',35],['Норма','40–80','#FFD700',60],['Высокий','> 80','#00E396',90]].map(([l,r,c,v]) =>
        `<button onclick="window.onbHRVSet(${v})"
          style="padding:8px 6px;border-radius:10px;border:1px solid ${c}44;background:${c}11;
                 cursor:pointer;text-align:center">
          <div style="font-size:10px;color:${c};font-weight:700">${l}</div>
          <div style="font-size:9px;color:rgba(232,237,245,.4)">${r}</div>
        </button>`
      ).join('')}
    </div>
  </div>`;
}

function hrvZoneHTML(val) {
  const v = parseInt(val);
  if (v < 40)  return `<span style="font-size:12px;color:#FF4560">🔴 Низкий HRV — высокий стресс / истощение</span>`;
  if (v < 60)  return `<span style="font-size:12px;color:#FFD700">🟡 Умеренный HRV — норма</span>`;
  if (v < 80)  return `<span style="font-size:12px;color:#00E396">🟢 Хороший HRV — восстановление нормальное</span>`;
  return `<span style="font-size:12px;color:#00F5D4">💚 Отличный HRV — ты в форме!</span>`;
}

let _hrvVal = 60;

window.onbHRVChange = function(delta) {
  _hrvVal = Math.min(120, Math.max(20, _hrvVal + delta));
  _updateHRV(_hrvVal);
};
window.onbHRVSlide = function(v) {
  _hrvVal = parseInt(v);
  _updateHRV(_hrvVal);
};
window.onbHRVSet = function(v) {
  _hrvVal = v;
  _updateHRV(v);
};
function _updateHRV(v) {
  const disp = document.getElementById('hrv-display');
  const slider = document.getElementById('hrv-slider');
  const zone = document.getElementById('hrv-zone');
  if (disp) disp.textContent = v;
  if (slider) slider.value = v;
  if (zone) zone.innerHTML = hrvZoneHTML(v);
  // Обновляем цвет числа
  const color = v < 40 ? '#FF4560' : v < 60 ? '#FFD700' : '#00E396';
  if (disp) disp.style.color = color;
  // Сохраняем сразу
  ответы['hrv_baseline'] = String(v);
}

function renderКнопкаЗаписи() {
  return `<div style="text-align:center;padding:16px 0">
    <button id="rec-btn" onclick="window.onbЗапись()" style="
      width:100px;height:100px;border-radius:50%;
      background:linear-gradient(135deg,#FF4560,#FF6B6B);
      border:none;cursor:pointer;font-size:38px;color:#fff;
      box-shadow:0 0 30px rgba(255,69,96,.5);
      transition:transform .2s">
      🎙️
    </button>
    <div id="rec-status" style="font-size:13px;color:rgba(232,237,245,.55);margin-top:14px">
      Нажми и говори
    </div>
    <div id="rec-timer" style="font-family:'Orbitron';font-size:18px;color:#FF4560;margin-top:6px;min-height:22px"></div>
    <div id="rec-warning" style="font-size:10px;color:rgba(255,159,67,.8);margin-top:4px;min-height:14px"></div>
    <div id="rec-actions" style="margin-top:14px;display:none"></div>
  </div>`;
}

function renderОшибкаЗаписи(сообщение) {
  const есть = последняяЗапись !== null;
  const статус = document.getElementById('rec-status');
  const действия = document.getElementById('rec-actions');
  if (статус) {
    статус.innerHTML = `<span style="color:#FF6B6B">❌ ${сообщение}</span><br>
      <small style="opacity:.65">${есть ? 'Аудио не потеряно — можно скачать или повторить' : ''}</small>`;
  }
  if (действия) {
    действия.style.display = 'block';
    действия.innerHTML = `
      ${есть ? `
        <button class="btn btn-teal" style="width:100%;margin-bottom:6px" onclick="window.onbПовтор()">↻ Попробовать снова</button>
        <button class="btn btn-ghost" style="width:100%;margin-bottom:6px" onclick="window.onbСкачать()">⬇️ Скачать аудио (.webm)</button>
      ` : ''}
      <div style="font-size:10px;color:rgba(232,237,245,.45);margin-top:8px;text-align:left">
        Можно вставить расшифровку вручную через «✍️ Или вставь текстом» ниже.
      </div>
    `;
  }
}

function renderОтвет(текст) {
  return `<div style="background:rgba(0,245,212,.05);border:1px solid rgba(0,245,212,.2);border-radius:12px;padding:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:10px;color:#00F5D4;letter-spacing:.05em">РАСШИФРОВАНО ✓</div>
      <button onclick="window.onbПерезаписать()" style="background:none;border:none;color:rgba(232,237,245,.5);font-size:11px;cursor:pointer">↻ Перезаписать</button>
    </div>
    <div style="font-size:13px;color:#E8EDF5;line-height:1.55;max-height:200px;overflow-y:auto">${текст}</div>
  </div>`;
}

// ── ЗАПИСЬ ────────────────────────────────────────────────────────────────────
window.onbЗапись = async function() {
  const кнопка = document.getElementById('rec-btn');
  const статус = document.getElementById('rec-status');
  const таймерЭл = document.getElementById('rec-timer');
  const предупр = document.getElementById('rec-warning');

  if (рекордер && рекордер.state === 'recording') {
    // Стоп
    рекордер.stop();
    кнопка.style.background = 'linear-gradient(135deg,#FF4560,#FF6B6B)';
    кнопка.style.animation = 'none';
    статус.textContent = '⏳ Сохраняю запись…';
    if (таймер) clearInterval(таймер);
    return;
  }

  // Старт
  try {
    поток = await navigator.mediaDevices.getUserMedia({ audio: true });
    аудиоЧанки = [];
    последняяЗапись = null;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    последнийМимТип = mimeType;
    рекордер = new MediaRecorder(поток, { mimeType });

    рекордер.ondataavailable = e => { if (e.data.size > 0) аудиоЧанки.push(e.data); };
    рекордер.onstop = async () => {
      поток.getTracks().forEach(t => t.stop());
      const blob = new Blob(аудиоЧанки, { type: mimeType });
      последняяЗапись = blob;          // в RAM — на текущую сессию
      // СОХРАНЯЕМ НА ДИСК БРАУЗЕРА (IndexedDB) — выживает перезагрузки и крэши
      await сохранитьАудио(БЛОКИ[текущийБлок].key, blob, mimeType);
      const размерМб = (blob.size / 1024 / 1024).toFixed(1);
      document.getElementById('rec-status').textContent = `⏳ Отправляю на расшифровку… (${размерМб} МБ)`;
      await отправитьНаРасшифровку(blob, mimeType);
    };

    рекордер.start();
    секунды = 0;
    таймерЭл.textContent = '00:00';
    предупр.textContent = '';
    таймер = setInterval(() => {
      секунды++;
      const m = String(Math.floor(секунды/60)).padStart(2,'0');
      const s = String(секунды%60).padStart(2,'0');
      таймерЭл.textContent = `${m}:${s}`;
      // Предупреждение при превышении 3 минут
      if (секунды === 180) {
        предупр.textContent = '⚠️ Запись длинная — лучше нажать ⏹ и записать продолжение отдельно';
      } else if (секунды >= 240) {
        предупр.textContent = '⚠️ Очень длинная — большой шанс что сервер не успеет. Остановись сейчас.';
      }
    }, 1000);

    кнопка.style.background = 'linear-gradient(135deg,#7B61FF,#00F5D4)';
    кнопка.style.animation = 'pulseRec 1.2s ease-in-out infinite';
    кнопка.textContent = '⏹';
    статус.textContent = 'Идёт запись… (нажми ⏹ когда закончишь)';
  } catch (err) {
    статус.textContent = '❌ Нет доступа к микрофону. Разреши в настройках Safari.';
    console.error(err);
  }
};

async function отправитьНаРасшифровку(blob, mimeType) {
  const размерМб = blob.size / 1024 / 1024;
  // Vercel hobby plan: max ~4.5 МБ тело запроса
  if (размерМб > 4) {
    renderОшибкаЗаписи(`Запись слишком большая (${размерМб.toFixed(1)} МБ). Vercel принимает до 4 МБ. Скачай файл и расшифруй вручную, либо запиши короче.`);
    document.getElementById('rec-btn').textContent = '🎙️';
    return;
  }

  // Таймаут — выдаём контроль, чтобы можно было показать ошибку и не зависнуть
  const controller = new AbortController();
  const таймаут = setTimeout(() => controller.abort(), 90000); // 90с

  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
      signal: controller.signal,
    });
    clearTimeout(таймаут);

    if (!res.ok) {
      const ошибка = await res.json().catch(() => ({error: `Сервер вернул ${res.status}`}));
      throw new Error(ошибка.error || 'Не удалось расшифровать');
    }
    const { text } = await res.json();
    ответы[БЛОКИ[текущийБлок].key] = text;
    последняяЗапись = null;
    await удалитьАудио(БЛОКИ[текущийБлок].key); // успех — чистим IndexedDB
    renderOnboarding();
  } catch (err) {
    clearTimeout(таймаут);
    const сообщ = err.name === 'AbortError'
      ? 'Сервер не успел за 90 секунд'
      : err.message;
    renderОшибкаЗаписи(сообщ);
    document.getElementById('rec-btn').textContent = '🎙️';
  }
}

// ── НОВЫЕ ХЕНДЛЕРЫ: повтор, скачать, ручной ввод ─────────────────────────────
window.onbПовтор = async function() {
  if (!последняяЗапись) return;
  document.getElementById('rec-actions').style.display = 'none';
  document.getElementById('rec-status').textContent = '⏳ Повторная попытка…';
  await отправитьНаРасшифровку(последняяЗапись, последнийМимТип);
};

window.onbСкачать = function() {
  if (!последняяЗапись) return;
  const url = URL.createObjectURL(последняяЗапись);
  const a = document.createElement('a');
  const дата = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const блок = БЛОКИ[текущийБлок].key;
  a.href = url;
  a.download = `lifeos-${блок}-${дата}.webm`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.onbСохранитьТекст = async function() {
  const поле = document.getElementById('manual-text');
  const текст = поле?.value?.trim();
  if (!текст || текст.length < 10) {
    поле?.focus();
    return;
  }
  ответы[БЛОКИ[текущийБлок].key] = текст;
  последняяЗапись = null;
  await удалитьАудио(БЛОКИ[текущийБлок].key);
  renderOnboarding();
};

// ── ВОССТАНОВЛЕНИЕ ИЗ INDEXEDDB ──────────────────────────────────────────────
window.onbВосстановить = async function() {
  const сохр = await загрузитьАудио(БЛОКИ[текущийБлок].key);
  if (!сохр) return;
  последняяЗапись = сохр.blob;
  последнийМимТип = сохр.mimeType;
  document.getElementById('rec-status').textContent = `⏳ Повтор расшифровки сохранённой записи (${сохр.sizeMb} МБ)…`;
  await отправитьНаРасшифровку(сохр.blob, сохр.mimeType);
};

window.onbСкачатьСохранённую = async function() {
  const сохр = await загрузитьАудио(БЛОКИ[текущийБлок].key);
  if (!сохр) return;
  последняяЗапись = сохр.blob;
  последнийМимТип = сохр.mimeType;
  window.onbСкачать();
};

window.onbУдалитьСохранённую = async function() {
  if (!confirm('Удалить сохранённую запись для этого блока? Восстановить будет нельзя.')) return;
  await удалитьАудио(БЛОКИ[текущийБлок].key);
  renderOnboarding();
};

window.onbПерезаписать = function() {
  delete ответы[БЛОКИ[текущийБлок].key];
  renderOnboarding();
};

window.onbПрев = function() {
  if (текущийБлок > 0) { текущийБлок--; renderOnboarding(); }
};

window.onbПропустить = function() {
  if (текущийБлок < БЛОКИ.length - 1) { текущийБлок++; renderOnboarding(); }
  else завершить();
};

window.onbДалее = async function() {
  if (текущийБлок < БЛОКИ.length - 1) { текущийБлок++; renderOnboarding(); }
  else завершить();
};

window.onbОтмена = function() {
  if (confirm('Заполнить приложение примерными данными и пройти онбординг позже?')) {
    localStorage.setItem('lifeos_onboarding_skipped', 'true');
    window.location.reload();
  }
};

// ── ЗАВЕРШЕНИЕ ────────────────────────────────────────────────────────────────
async function завершить() {
  const el = document.getElementById('content');
  el.innerHTML = `<div class="screen" style="text-align:center;padding-top:60px">
    <div style="font-size:72px;margin-bottom:18px;animation:pulseRec 1.5s infinite">🧠</div>
    <div style="font-family:'Orbitron';font-size:18px;color:#00F5D4;margin-bottom:10px">СОЗДАЁМ ТВОЮ ОС</div>
    <div style="font-size:13px;color:rgba(232,237,245,.55);max-width:280px;margin:0 auto;line-height:1.6">
      AI анализирует твои ответы и строит персональную структуру: проекты, задачи, людей, цели, RPG-характеристики…
    </div>
    <div style="margin-top:30px;font-size:11px;color:rgba(232,237,245,.35)">Это займёт 15–30 секунд</div>
  </div>`;

  // ── Сохраняем СЫРЫЕ ответы до отправки в AI — чтобы они не терялись ─────────
  try {
    localStorage.setItem('lifeos_onboarding_answers', JSON.stringify({
      at: new Date().toISOString(),
      answers: ответы,
    }));
  } catch (e) { console.warn('save onboarding answers:', e.message); }

  try {
    const res = await fetch('/api/extract-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ответы }),
    });
    if (!res.ok) {
      const e = await res.json().catch(()=>({}));
      throw new Error(e.error || 'Ошибка извлечения');
    }
    const { структура } = await res.json();

    // Применяем извлечённую структуру
    // Сохраняем HRV baseline из онбординга
    const hrvBaseline = parseInt(ответы['hrv_baseline'] || 60);
    if (структура.profile)         DB.saveProfile({ ...DB.getProfile(), ...структура.profile, hrvBaseline });
    if (структура.projects)        DB.saveProjects(структура.projects.map((p,i) => ({ id:'p'+(Date.now()+i), ...p })));
    if (структура.tasks)           DB.saveTasks(структура.tasks.map((t,i) => ({ id:'t'+(Date.now()+i), done:false, xpValue:50, createdAt:Date.now(), ...t })));
    if (структура.people)          DB.savePeople(структура.people.map((p,i) => ({ id:'pe'+(Date.now()+i), last:'сегодня', border: p.urgency==='urgent'?'#FF4560':p.urgency==='soon'?'#00F5D4':'rgba(232,237,245,.2)', ...p })));
    if (структура.quests)          DB.set('quests', структура.quests.map((q,i)=>({ id:'q'+i, done:false, ...q })));
    if (структура.weeklyChallenge) DB.set('weeklyChallenge', { progress:0, ...структура.weeklyChallenge });
    if (структура.rpgStats)        DB.set('rpgStats', структура.rpgStats);
    if (структура.dailyLog)        DB.saveDailyLog(структура.dailyLog);
    // Всегда сохраняем HRV baseline (даже если profile не вернул AI)
    if (!структура.profile) {
      const p = DB.getProfile();
      p.hrvBaseline = hrvBaseline;
      DB.saveProfile(p);
    }

    localStorage.setItem('lifeos_onboarded', 'true');
    localStorage.setItem('lifeos_onboarded_at', new Date().toISOString());

    // Показываем результат
    el.innerHTML = `<div class="screen" style="text-align:center;padding-top:80px">
      <div style="font-size:72px;margin-bottom:18px">✨</div>
      <div style="font-family:'Orbitron';font-size:20px;color:#FFD700;margin-bottom:10px">ВСЁ ГОТОВО!</div>
      <div style="font-size:13px;color:rgba(232,237,245,.7);max-width:300px;margin:0 auto;line-height:1.6">
        Твоя персональная ОС жизни создана.<br>
        Открой Главную чтобы увидеть свой мир.
      </div>
      <button class="btn btn-teal" style="margin-top:32px;padding:14px 30px;font-size:14px" onclick="window.location.href='/'">
        ⚡ Запустить LIFE OS
      </button>
      <button class="btn btn-ghost" style="margin-top:12px;padding:10px 22px;font-size:12px" onclick="window.copyOnboardingAnswers()">
        📋 Скопировать мои ответы
      </button>
    </div>`;
  } catch (err) {
    el.innerHTML = `<div class="screen" style="text-align:center;padding-top:60px">
      <div style="font-size:60px;margin-bottom:18px">⚠️</div>
      <div style="font-size:16px;color:#FF6B6B;margin-bottom:10px">Что-то пошло не так</div>
      <div style="font-size:12px;color:rgba(232,237,245,.55);padding:0 20px">${err.message}</div>
      <button class="btn btn-ghost" style="margin-top:20px" onclick="renderOnboarding()">← Вернуться</button>
      <button class="btn btn-teal" style="margin-top:10px" onclick="window.onbОтмена()">Заполнить вручную</button>
    </div>`;
  }
}

// Собрать ответы онбординга в один текстовый документ и скопировать
window.copyOnboardingAnswers = function() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('lifeos_onboarding_answers') || 'null'); }
  catch { saved = null; }
  if (!saved?.answers) { window.showToast?.('Сохранённых ответов не найдено', 'error'); return; }

  const a = saved.answers;
  const дата = new Date(saved.at || Date.now()).toLocaleString('ru-RU');
  let doc = `# Мой онбординг LIFE OS\n_${дата}_\n\n`;
  for (const блок of БЛОКИ) {
    if (блок.key === 'hrv_baseline') continue; // это число, не текст
    const ответ = a[блок.key];
    if (!ответ) continue;
    doc += `## ${блок.title}\n${ответ}\n\n`;
  }
  if (a['hrv_baseline']) doc += `## Калибровка HRV\nБазовый HRV: ${a['hrv_baseline']} мс\n`;

  navigator.clipboard?.writeText(doc).then(
    () => window.showToast?.('📋 Ответы скопированы в буфер', 'success'),
    () => { prompt('Скопируй вручную:', doc); }
  );
};

// Anim для записи
const style = document.createElement('style');
style.textContent = `@keyframes pulseRec { 0%,100%{transform:scale(1);box-shadow:0 0 30px rgba(255,69,96,.5)} 50%{transform:scale(1.08);box-shadow:0 0 50px rgba(0,245,212,.7)} }`;
document.head.appendChild(style);

// Expose for retry
window.renderOnboarding = renderOnboarding;
