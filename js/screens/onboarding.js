// ── ЭКРАН ОНБОРДИНГА: голосовое заполнение всей системы ──────────────────────
import { DB } from '../db.js';

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

export function renderOnboarding() {
  const блок = БЛОКИ[текущийБлок];
  const прогресс = Math.round(((текущийБлок) / БЛОКИ.length) * 100);
  const ответ = ответы[блок.key];

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
      ${ответ ? renderОтвет(ответ) : renderКнопкаЗаписи()}
    </div>

    <div style="display:flex;gap:8px;margin-top:16px">
      ${текущийБлок > 0
        ? `<button class="btn btn-ghost" style="flex:1" onclick="window.onbПрев()">← Назад</button>`
        : ''}
      ${ответ
        ? `<button class="btn btn-teal" style="flex:2" onclick="window.onbДалее()">${текущийБлок === БЛОКИ.length-1 ? '🚀 Создать мою ОС' : 'Далее →'}</button>`
        : `<button class="btn btn-ghost" style="flex:2" onclick="window.onbПропустить()">Пропустить блок</button>`}
    </div>

    <button class="btn btn-ghost" style="width:100%;margin-top:20px;opacity:.5;font-size:10px" onclick="window.onbОтмена()">
      Заполнить вручную (без AI)
    </button>

  </div>`;
}

function renderКнопкаЗаписи() {
  return `<div style="text-align:center;padding:20px 0">
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
  </div>`;
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

  if (рекордер && рекордер.state === 'recording') {
    // Стоп
    рекордер.stop();
    кнопка.style.background = 'linear-gradient(135deg,#FF4560,#FF6B6B)';
    кнопка.style.animation = 'none';
    статус.textContent = 'Расшифровываю…';
    if (таймер) clearInterval(таймер);
    return;
  }

  // Старт
  try {
    поток = await navigator.mediaDevices.getUserMedia({ audio: true });
    аудиоЧанки = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    рекордер = new MediaRecorder(поток, { mimeType });

    рекордер.ondataavailable = e => { if (e.data.size > 0) аудиоЧанки.push(e.data); };
    рекордер.onstop = async () => {
      поток.getTracks().forEach(t => t.stop());
      const blob = new Blob(аудиоЧанки, { type: mimeType });
      await отправитьНаРасшифровку(blob, mimeType);
    };

    рекордер.start();
    секунды = 0;
    таймерЭл.textContent = '00:00';
    таймер = setInterval(() => {
      секунды++;
      const m = String(Math.floor(секунды/60)).padStart(2,'0');
      const s = String(секунды%60).padStart(2,'0');
      таймерЭл.textContent = `${m}:${s}`;
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
  try {
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });
    if (!res.ok) {
      const ошибка = await res.json().catch(() => ({error: 'Ошибка сервера'}));
      throw new Error(ошибка.error || 'Не удалось расшифровать');
    }
    const { text } = await res.json();
    ответы[БЛОКИ[текущийБлок].key] = text;
    renderOnboarding();
  } catch (err) {
    document.getElementById('rec-status').innerHTML = `❌ ${err.message}<br><small style="opacity:.6">Проверь что OPENAI_API_KEY добавлен в Vercel</small>`;
    document.getElementById('rec-btn').textContent = '🎙️';
  }
}

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
    if (структура.profile)         DB.saveProfile({ ...DB.getProfile(), ...структура.profile });
    if (структура.projects)        DB.saveProjects(структура.projects.map((p,i) => ({ id:'p'+(Date.now()+i), ...p })));
    if (структура.tasks)           DB.saveTasks(структура.tasks.map((t,i) => ({ id:'t'+(Date.now()+i), done:false, xpValue:50, createdAt:Date.now(), ...t })));
    if (структура.people)          DB.savePeople(структура.people.map((p,i) => ({ id:'pe'+(Date.now()+i), last:'сегодня', border: p.urgency==='urgent'?'#FF4560':p.urgency==='soon'?'#00F5D4':'rgba(232,237,245,.2)', ...p })));
    if (структура.quests)          DB.set('quests', структура.quests.map((q,i)=>({ id:'q'+i, done:false, ...q })));
    if (структура.weeklyChallenge) DB.set('weeklyChallenge', { progress:0, ...структура.weeklyChallenge });
    if (структура.rpgStats)        DB.set('rpgStats', структура.rpgStats);
    if (структура.dailyLog)        DB.saveDailyLog(структура.dailyLog);

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

// Anim для записи
const style = document.createElement('style');
style.textContent = `@keyframes pulseRec { 0%,100%{transform:scale(1);box-shadow:0 0 30px rgba(255,69,96,.5)} 50%{transform:scale(1.08);box-shadow:0 0 50px rgba(0,245,212,.7)} }`;
document.head.appendChild(style);

// Expose for retry
window.renderOnboarding = renderOnboarding;
