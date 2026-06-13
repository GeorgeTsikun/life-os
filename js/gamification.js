// ── ДВИЖОК ГЕЙМИФИКАЦИИ ───────────────────────────────────────────────────────
import { DB } from './db.js?v=33';

// XP, необходимый для уровня n (начиная с 1)
// Быстрый старт как в RPG: L1=50, L2=100, L3=150, L4=280, L5=430, L10=15000
export function xpForLevel(n) {
  if (n <= 3) return Math.round(50 * n);
  if (n <= 7) return Math.round(100 * Math.pow(n, 1.6));
  return Math.round(150 * Math.pow(n, 2));
}

// Суммарный XP для достижения уровня n (начиная с нуля)
export function totalXpForLevel(n) {
  let итого = 0;
  for (let i = 1; i < n; i++) итого += xpForLevel(i);
  return итого;
}

// Текущий уровень по суммарному XP
export function levelFromXp(xp) {
  let уровень = 1;
  let накоплено = 0;
  while (накоплено + xpForLevel(уровень) <= xp) {
    накоплено += xpForLevel(уровень);
    уровень++;
    if (уровень > 100) break;
  }
  return уровень;
}

// Прогресс внутри текущего уровня (0–1)
export function xpProgress(xp) {
  const уровень = levelFromXp(xp);
  const база   = totalXpForLevel(уровень);
  const нужно  = xpForLevel(уровень);
  return (xp - база) / нужно;
}

// Множитель страйка
export function streakMultiplier(страйк) {
  if (страйк >= 30) return 1.5;
  if (страйк >= 14) return 1.25;
  if (страйк >= 7)  return 1.1;
  return 1;
}

// Источники XP
export const XP_SOURCES = {
  task_q1:       75,   // Важно и срочно
  task_q2:       50,   // Важно, не срочно
  task_q3:       25,   // Делегировано
  task_q4:       25,   // Ликвидировано
  workout:       100,  // Тренировка
  sleep_7h:      75,   // Сон 7ч+
  sleep_8h:      100,  // Сон 8ч+
  water_2l:      30,   // Вода 2л+
  nutrition_8:   50,   // Питание 8/10+
  supplements:   20,   // БАДы
  shower:        20,   // Контрастный душ
  quest:         150,  // Квест дня
  challenge:     500,  // Еженедельный челлендж
  project_milestone: 200, // Веха проекта
  daily_log:     10,   // Дневник энергии
};

// RPG-характеристики: ключ, ярлык, цвет, описание
// Соответствует спеку §4.3: STR / VIT / SOC / WIS / ENG
export const RPG_STATS = [
  { key:'STR', label:'BODY💪🏻', color:'#FF6B6B', desc:'Спорт и тренировки',       decay: 5 },
  { key:'VIT', label:'RCVR♥️', color:'#00E396', desc:'Сон, HRV и питание',        decay: 8 },
  { key:'SOC', label:'PPL🫂', color:'#FF9F43', desc:'Люди и обязательства',      decay: 4 },
  { key:'WIS', label:'MIND🧠', color:'#00C9FF', desc:'Журнал энергии и ревью',    decay: 3 },
  { key:'ENG', label:'NRG⚡️', color:'#00F5D4', desc:'Энергия (HRV + задачи Q2)', decay: 0 }, // динамический
];

// Начисляем XP и обновляем профиль
export function awardXP(количество, источник = '') {
  const профиль = DB.getProfile();
  const страйк  = профиль.streak || 0;
  const множ    = streakMultiplier(страйк);
  const факт    = Math.round(количество * множ);
  const новый   = (профиль.xp || 0) + факт;
  const старыйУр = levelFromXp(профиль.xp || 0);
  const новыйУр  = levelFromXp(новый);

  профиль.xp    = новый;
  профиль.level = новыйУр;

  // Обновляем страйк
  const сегодня   = new Date().toDateString();
  const вчера     = new Date(Date.now() - 86400000).toDateString();
  if (профиль.lastActive !== сегодня) {
    профиль.streak    = профиль.lastActive === вчера ? (страйк + 1) : 1;
    профиль.lastActive = сегодня;
  }

  DB.saveProfile(профиль);

  // Показываем всплывающий XP
  показатьXpFloat(`+${факт} XP`);

  // Уровень вырос?
  if (новыйУр > старыйУр) {
    setTimeout(() => показатьТост('levelup', `Уровень ${новыйУр}!`, `Новый уровень — ЖАРА 🔥`, '', true), 600);
  }

  // Проверяем достижения
  проверитьДостижения();

  return { факт, новый, новыйУр, выросУровень: новыйУр > старыйУр };
}

// Функции UI — инжектируются из app.js
let _показатьТост  = () => {};
let _показатьFloat = () => {};

export function injectUI(тостФн, floatФн) {
  _показатьТост  = тостФн;
  _показатьFloat = floatФн;
}

function показатьТост(иконка, заголовок, текст, xp, достижение = false) {
  _показатьТост(иконка, заголовок, текст, xp, достижение);
}

function показатьXpFloat(текст) {
  _показатьFloat(текст);
}

// Проверка достижений
export function проверитьДостижения() {
  const профиль = DB.getProfile();
  const достижения = DB.getAchievements();

  const проверить = (ключ, условие) => {
    const д = достижения.find(x => x.key === ключ);
    if (д && !д.unlocked && условие) {
      const разблокировано = DB.unlockAchievement(ключ);
      if (разблокировано) {
        показатьТост('🏆', `Достижение: ${разблокировано.name}`, 'Получено!', '+250 XP', true);
      }
    }
  };

  проверить('streak7',      (профиль.streak || 0) >= 7);
  проверить('level10',      (профиль.level  || 1) >= 10);
  проверить('crm_pro',      DB.getPeople().length >= 5);
  проверить('100k',         DB.getProjects().some(p => p.current >= 100000));
  проверить('iron_week',    DB.getGymDays().filter(Boolean).length >= 5);
  проверить('sleep_master', (DB.getHealth().weeklyData || []).filter(h => h >= 8).length >= 5);
}

// Псевдоним для импортов
export const checkAchievements = проверитьДостижения;

// Debuff-режим: если любая шкала < 30 → класс на body
export function applyDebuffMode() {
  const шкалы = DB.getRpgStats();
  const вДебаффе = RPG_STATS.some(s => (шкалы[s.key] ?? 50) < 30);
  document.body.classList.toggle('debuff', вДебаффе);
}

// XP за выполненную задачу (с Energy_Factor при низком HRV)
export function onTaskToggled(задача) {
  if (задача.done) {
    const карта = { do:'task_q1', schedule:'task_q2', delegate:'task_q3', eliminate:'task_q4' };
    const источник = карта[задача.quadrant] || 'task_q2';
    const base = задача.xpValue || XP_SOURCES[источник] || 50;

    // §4.2 Energy_Factor: HRV < 30 + сложность ≥ 4 → бонус ×1.5 за сверхусилие
    const hrv  = DB.getHealth().hrv || 60;
    const diff = задача.difficulty || 2;
    const ef   = (hrv < 30 && diff >= 4) ? 1.5 : 1.0;
    const итогоXP = Math.round(base * ef);

    awardXP(итогоXP, источник);
    if (ef > 1) {
      показатьXpFloat(`+${итогоXP} XP ×1.5 💪`);
    }

    // Обновляем прогресс еженедельного челленджа
    if (задача.quadrant === 'do') {
      const чел = DB.getWeeklyChallenge();
      if (чел && !чел.completed) {
        чел.progress = (чел.progress || 0) + 1;
        if (чел.progress >= чел.target) {
          чел.completed = true;
          awardXP(чел.xp, 'challenge');
          показатьТост('⚡', 'Еженедельный челлендж выполнен!', чел.title, `+${чел.xp} XP`, true);
        }
        DB.set('weeklyChallenge', чел);
      }
    }
  }
}

export function onQuestCompleted(квест) {
  if (квест) {
    awardXP(квест.xp, 'quest');
    показатьТост('✅', 'Квест выполнен!', квест.title, `+${квест.xp} XP`);
  }
}

export function onWorkoutLogged(xp) {
  awardXP(xp, 'workout');
  показатьТост('💪', 'Тренировка записана!', 'Отличная работа!', `+${xp} XP`);
  проверитьДостижения();
}

export function onNutritionUpdated(питание) {
  let итого = 0;
  if (питание.supplements) итого += XP_SOURCES.supplements;
  if (питание.shower)      итого += XP_SOURCES.shower;
  if (питание.water >= 2)  итого += XP_SOURCES.water_2l;
  if (питание.score >= 8)  итого += XP_SOURCES.nutrition_8;
  if (итого > 0) awardXP(итого, 'nutrition');
}

// ── REAL CAPACITY (RC) ────────────────────────────────────────────────────────
// §5.1–5.2: RC = (sleep_h / 8) × (hrv_current / hrv_baseline)
// Режимы: HIGH > 1.1, NORM 0.8–1.1, LOW < 0.8

export function calcRC(health, profile) {
  const sleepH  = health?.sleep?.hours  ?? 7.5;
  const hrv     = health?.hrv           ?? 55;
  const baseline = profile?.hrvBaseline ?? 55; // среднее за 14 дней (обновляем ниже)
  const rc = (sleepH / 8) * (hrv / Math.max(baseline, 1));
  return Math.round(rc * 100) / 100; // 0.00 – 2.00+
}

export function rcMode(rc) {
  if (rc >= 1.1)  return { key: 'high', label: '🚀 ВЫСОКИЙ',   color: '#00F5D4', hint: 'Бери сложные Q1 и стратегию' };
  if (rc >= 0.8)  return { key: 'norm', label: '⚡ НОРМА',      color: '#FFD700', hint: 'Обычный ритм, Q1 + Q2' };
  return           { key: 'low',  label: '🐢 БАШКА ТУПИТ', color: '#FF6B6B', hint: 'Только рутина и восстановление' };
}

// Обновляем скользящий baseline HRV (14-дневное среднее)
export function updateHrvBaseline(hrv) {
  const p = DB.getProfile();
  const history = p.hrvHistory || [];
  history.push(hrv);
  if (history.length > 14) history.shift();
  p.hrvHistory  = history;
  p.hrvBaseline = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  DB.saveProfile(p);
}
