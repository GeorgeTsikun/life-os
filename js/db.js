// ── СЛОЙ ДАННЫХ ───────────────────────────────────────────────────────────────
import { KNOWLEDGE_SEED } from './data/knowledge.js?v=55';
// Приоритет: localStorage (работает без интернета).
// Если заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY — синхронизируется с Supabase.
// Переменные окружения читаются из window.__ENV__ (injected Vercel) или import.meta.env

const ENV = window.__ENV__ || {};
const SUPABASE_URL  = ENV.SUPABASE_URL  || '';
const SUPABASE_KEY  = ENV.SUPABASE_KEY  || '';

const supabaseАктивен = () => !!(SUPABASE_URL && SUPABASE_KEY);

// ── НАЧАЛЬНЫЕ ДАННЫЕ ──────────────────────────────────────────────────────────
const ДАННЫЕ = {
  profile: {
    name: 'ДЖОРДЖ',
    tagline: 'ВИЗИОНЕР · СОЗДАТЕЛЬ · ЛИДЕР',
    avatar: '👑',
    photo: 'assets/avatar.jpg',  // путь к фото (fallback на эмоджи)
    level: 1,
    xp: 0,
    coins: 0,                     // трачимая валюта — на «развлечения» / прокрастинацию
    coinsSpent: 0,                // всего потрачено за всё время
    streak: 1,
    lastActive: new Date().toDateString(),
  },
  tasks: [],
  projects: [],
  people: [],
  health: {
    sleep: {hours:7.2,quality:85,deep:22,rem:18,bedtime:'23:15',wake:'06:27'},
    hrv: 58,
    restingHr: 58,
    steps: 8420,
    calories: 420,
    km: 6.2,
    move: 78,
    exercise: 65,
    stand: 90,
    lastSync: new Date().toISOString(),
    weeklyData: [7.2,6.8,7.5,6.5,8.0,7.8,8.2],
    energyData: [65,72,88,75,91,60,55],
    pulseData: [58,62,60,55,58,56,60,62,59],
    hrvData: [52,58,55,48,45,42,50,56,60],
  },
  nutrition: {
    water: 0,
    waterGoal: 2.5,
    score: 0,
    supplements: false,
    shower: false,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    caloriesGoal: 2200,
    proteinGoal: 140,
    carbsGoal: 220,
    fatGoal: 70,
    date: new Date().toDateString(),
  },
  workouts: [
    {id:'w1',date:new Date().toDateString(),type:'Силовая',duration:60,xp:100,emoji:'🏋️'},
    {id:'w2',date:new Date(Date.now()-2*86400000).toDateString(),type:'Кардио',duration:40,xp:80,emoji:'🏃'},
    {id:'w3',date:new Date(Date.now()-4*86400000).toDateString(),type:'Силовая',duration:65,xp:100,emoji:'🏋️'},
    {id:'w4',date:new Date(Date.now()-5*86400000).toDateString(),type:'Плавание',duration:45,xp:90,emoji:'🏊'},
  ],
  gymDays: [true,false,true,true,false,true,false],
  quests: [
    {id:'q1',title:'Закрыть главную задачу Q1',icon:'🎯',xp:150,done:false},
    {id:'q2',title:'Выпить 2.5л воды',icon:'💧',xp:150,done:false},
    {id:'q3',title:'Сделать тренировку',icon:'💪',xp:150,done:false},
  ],

  // ── КАТАЛОГ УДОВОЛЬСТВИЙ (из твоей таблицы GAMECHANGER) ──────────────────
  pleasureCatalog: [
    { id:'pl1',  icon:'📱', name:'Соцсети / скроллинг',     cost:15,  category:'быстрый_дофамин' },
    { id:'pl2',  icon:'🎬', name:'Фильм / сериал',           cost:20,  category:'развлечение' },
    { id:'pl3',  icon:'🛋️', name:'Просто релакс',            cost:20,  category:'отдых' },
    { id:'pl4',  icon:'🎥', name:'Кино / выход',              cost:30,  category:'развлечение' },
    { id:'pl5',  icon:'💨', name:'Кальян',                   cost:25,  category:'быстрый_дофамин' },
    { id:'pl6',  icon:'🍽️', name:'Ресторан / доставка',      cost:20,  category:'удовольствие' },
    { id:'pl7',  icon:'💆', name:'Массаж',                   cost:15,  category:'отдых' },
    { id:'pl8',  icon:'🧖', name:'Сауна / баня',              cost:5,   category:'здоровье' },
    { id:'pl9',  icon:'🛁', name:'Ванна',                    cost:10,  category:'отдых' },
    { id:'pl10', icon:'📚', name:'Читать книгу',              cost:5,   category:'развитие' },
    { id:'pl11', icon:'🧠', name:'Обучающий YouTube',         cost:10,  category:'развитие' },
    { id:'pl12', icon:'📊', name:'Бизнес-новости',            cost:5,   category:'развитие' },
    { id:'pl13', icon:'📰', name:'Политические новости',      cost:15,  category:'быстрый_дофамин' },
    { id:'pl14', icon:'🎮', name:'Игры',                      cost:25,  category:'быстрый_дофамин' },
    { id:'pl15', icon:'🏖️', name:'Поездка / отпуск',          cost:100, category:'большой_приз' },
  ],

  // ── ИСТОРИЯ ТРАТ УДОВОЛЬСТВИЙ ─────────────────────────────────────────────
  pleasureLog: [],

  // ── БАЛАНС (отдельно от XP — трачимый/накопительный) ─────────────────────
  // balance = сумма xpValue выполненных задач − сумма потраченных удовольствий
  // Пересчитывается из pleasureLog и tasks при каждом запросе
  achievements: [
    {key:'streak7',icon:'🔥',name:'7-дн. страйк',unlocked:true,color:'#FFD700'},
    {key:'first_client',icon:'🚀',name:'Первый клиент',unlocked:true,color:'#00F5D4'},
    {key:'focus_master',icon:'🧠',name:'Мастер фокуса',unlocked:false,color:'#7B61FF'},
    {key:'club300',icon:'💎',name:'Клуб 300',unlocked:false,color:'#00E396'},
    {key:'iron_week',icon:'🏋️',name:'Железная неделя',unlocked:false,color:'#FF9F43'},
    {key:'sleep_master',icon:'🌙',name:'Мастер сна',unlocked:false,color:'#7B61FF'},
    {key:'crm_pro',icon:'🤝',name:'CRM Про',unlocked:true,color:'#00E396'},
    {key:'100k',icon:'💰',name:'Первые 100К',unlocked:true,color:'#FFD700'},
    {key:'deep_focus',icon:'🎯',name:'Глубокий фокус',unlocked:false,color:'#00F5D4'},
    {key:'level10',icon:'👑',name:'Уровень 10',unlocked:false,color:'#FFD700'},
    {key:'nutrition_week',icon:'🥗',name:'Неделя питания',unlocked:false,color:'#00E396'},
    {key:'water_streak',icon:'💧',name:'7 дней воды',unlocked:false,color:'#00C9FF'},
  ],
  dailyLog: {
    energy: 7,
    mood: '😊',
    focus: 2.5,
    note: '',
  },
  weeklyChallenge: {
    title: 'Закрыть 5 задач Q1 за неделю',
    progress: 2,
    target: 5,
    xp: 500,
    emoji: '⚡',
  },
  rpgStats: {
    STR: 62,
    VIT: 70,
    SOC: 55,  // CHA→SOC (Социум)
    WIS: 48,
    ENG: 52,  // FOC→ENG (Энергобаланс, динамический от HRV)
  },
};

// ── ХРАНИЛИЩЕ (localStorage) ──────────────────────────────────────────────────
function хранилищеПолучить(ключ) {
  try { return JSON.parse(localStorage.getItem('lifeos_' + ключ)); }
  catch { return null; }
}

function хранилищеСохранить(ключ, значение) {
  try { localStorage.setItem('lifeos_' + ключ, JSON.stringify(значение)); }
  catch {}
}

function инициализировать() {
  if (!хранилищеПолучить('initialized')) {
    Object.entries(ДАННЫЕ).forEach(([к, в]) => хранилищеСохранить(к, в));
    хранилищеСохранить('initialized', true);
  }
  // Миграция v2: сброс XP/уровня → старт с Уровня 1, добавление coins/photo
  if (!хранилищеПолучить('migrated_v2_level1')) {
    const profile = хранилищеПолучить('profile') || {};
    profile.level = 1;
    profile.xp = 0;
    profile.coins = profile.coins ?? 0;
    profile.coinsSpent = profile.coinsSpent ?? 0;
    profile.photo = profile.photo || 'assets/avatar.jpg';
    хранилищеСохранить('profile', profile);
    хранилищеСохранить('migrated_v2_level1', true);
  }
  // Миграция v3: переименование RPG-шкал INT→убрать, CHA→SOC, FOC→ENG
  if (!хранилищеПолучить('migrated_v3_rpg_stats')) {
    const rpg = хранилищеПолучить('rpgStats') || {};
    if ('INT' in rpg) delete rpg.INT;
    if ('FOC' in rpg) { rpg.ENG = rpg.FOC; delete rpg.FOC; }
    if ('CHA' in rpg) { rpg.SOC = rpg.CHA; delete rpg.CHA; }
    rpg.ENG = rpg.ENG ?? 52;
    rpg.SOC = rpg.SOC ?? 55;
    хранилищеСохранить('rpgStats', rpg);
    хранилищеСохранить('migrated_v3_rpg_stats', true);
  }
  // Миграция v4: жёсткий сброс профиля — L1/0 XP, фото принудительно
  if (!хранилищеПолучить('migrated_v4_hard_reset')) {
    const p = хранилищеПолучить('profile') || {};
    p.level = 1;
    p.xp = 0;
    p.streak = p.streak ?? 1;
    p.photo = 'assets/avatar.jpg';  // принудительно — фото с акулами
    p.lastDecayDate = null;         // сброс деградации
    p.lastQuestReset = null;        // сброс квестов
    хранилищеСохранить('profile', p);
    // Сброс квестов в изначальное состояние (done: false)
    const кв = хранилищеПолучить('quests') || ДАННЫЕ.quests;
    хранилищеСохранить('quests', кв.map(q => ({ ...q, done: false })));
    хранилищеСохранить('migrated_v4_hard_reset', true);
  }
  // Миграция v5: повторный сброс (набрал XP при тестировании после v4)
  if (!хранилищеПолучить('migrated_v5_reset_again')) {
    const p = хранилищеПолучить('profile') || {};
    p.level = 1;
    p.xp    = 0;
    хранилищеСохранить('profile', p);
    хранилищеСохранить('migrated_v5_reset_again', true);
  }
}

// ── ПУБЛИЧНОЕ API ─────────────────────────────────────────────────────────────
export const DB = {
  init() {
    инициализировать();
    this.migrateTaskIdsToUUID();   // §migration: t-id → UUID для корректного upsert
    this.migrateRelativeDatesToISO(); // §migration: 'завтра'/'сегодня' → реальные ISO даты
    this.applyDailyDecay();
    this.resetDailyQuests();
    this.resetDailyNutrition();
    this.pruneOldNutritionData();
    const moved = this.sweepQ4toIdeaBank();
    if (moved > 0) window.showToast?.(`💡 ${moved} идей из Q4 → Банк идей`, 'info');
  },

  // ── МИГРАЦИЯ: не-UUID id → UUID ──────────────────────────────────────────────
  // Старые задачи имели id вида 't1718...'. Supabase upsert требует UUID, иначе
  // INSERT создавал дубль, а при следующем pull старая запись с done=false
  // "возвращала" уже выполненные задачи. Эта миграция одноразовая.
  migrateTaskIdsToUUID() {
    if (localStorage.getItem('lifeos_uuid_migrated_v1') === '1') return;
    const isUuid = s => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const newUuid = () => (crypto?.randomUUID?.() || ('t' + Date.now() + Math.random().toString(36).slice(2,10)));

    const задачи = this.getTasks();
    let counter = 0;
    задачи.forEach(t => {
      if (!isUuid(t.id)) { t.id = newUuid(); counter++; }
    });
    if (counter > 0) {
      this.saveTasks(задачи);
      console.log(`[migration] обновил ${counter} task id → UUID`);
    }
    localStorage.setItem('lifeos_uuid_migrated_v1', '1');
  },

  // ── МИГРАЦИЯ: 'завтра'/'сегодня'/etc → реальная ISO дата ────────────────────
  // Задачи, созданные до исправления, имеют time='завтра' и due_date=null.
  // парсДату('завтра') считает дату динамически — задача ВЕЧНО "завтра".
  // Эта миграция конвертирует относительные строки в реальные ISO даты.
  migrateRelativeDatesToISO() {
    const КЛЮЧ = 'lifeos_reldate_migrated_v1';
    if (localStorage.getItem(КЛЮЧ) === '1') return;

    // Инлайн-реализация парсера (нельзя импортировать ES module из plain object)
    const parseRel = (s) => {
      if (!s || typeof s !== 'string') return null;
      const low = s.trim().toLowerCase();
      if (!low || low === '—' || low === '-') return null;
      // Уже ISO
      if (/^\d{4}-\d{2}-\d{2}/.test(low)) return null; // уже ок
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0);
      if (low.includes('сегодн'))  return today;
      if (low.includes('завтра'))  { const d = new Date(today); d.setDate(d.getDate()+1); return d; }
      if (low.includes('послезавтра')) { const d = new Date(today); d.setDate(d.getDate()+2); return d; }
      if (low.includes('вчера'))   { const d = new Date(today); d.setDate(d.getDate()-1); return d; }
      return null;
    };

    const задачи = this.getTasks();
    let counter = 0;
    задачи.forEach(t => {
      if (!t.due_date && t.time) {
        const d = parseRel(t.time);
        if (d) {
          // Сохраняем как ISO, оригинальный time не трогаем (для отображения)
          t.due_date = d.toISOString();
          counter++;
        }
      }
    });
    if (counter > 0) {
      this.saveTasks(задачи);
      console.log(`[migration] ${counter} задач: relative time → ISO due_date`);
    }
    localStorage.setItem(КЛЮЧ, '1');
  },

  get(ключ)       { return хранилищеПолучить(ключ) ?? ДАННЫЕ[ключ]; },
  set(ключ, знач) { хранилищеСохранить(ключ, знач); },

  // Задачи
  getTasks()      { return this.get('tasks'); },
  saveTasks(t)    { this.set('tasks', t); },

  // §4.2 — Расчёт базового XP по формуле спека
  calcBaseXP(difficulty, quadrant) {
    const d  = Math.min(5, Math.max(1, difficulty || 2));
    const PM = { do: 1.5, schedule: 1.3, delegate: 1.0, eliminate: 0.5 };
    return Math.round(d * 10 * (PM[quadrant] || 1.0));
  },

  // §3.2 — Проверка лимита Q1 > 5
  q1Count() {
    return this.getTasks().filter(t => !t.done && !t.cancelled && t.quadrant === 'do').length;
  },

  addTask(задача) {
    // §3.1 — HRV < 30 три дня подряд → блок новых Q1
    if (задача.quadrant === 'do' && !задача._forceQ1) {
      const h = this.getHealth();
      const hrvArr = (h?.hrvData || []).slice(-3);
      if (hrvArr.length >= 3 && hrvArr.every(v => v < 30)) {
        window.showToast?.('⚠️ HRV < 30 три дня. Q1 заблокированы — восстановись.', 'error');
        return null;
      }
    }
    // §3.2 — Лимит Q1 ≥ 5: жёсткий блок
    if (задача.quadrant === 'do' && !задача._forceQ1) {
      if (this.q1Count() >= 5) {
        window.showQ1Block?.();
        return null;
      }
    }
    const задачи = this.getTasks();
    const difficulty = задача.difficulty || 2;
    const новая = {
      id: (crypto?.randomUUID?.() || ('t' + Date.now() + Math.random().toString(36).slice(2,10))),
      difficulty,
      xpValue: this.calcBaseXP(difficulty, задача.quadrant || 'schedule'),
      done: false,
      createdAt: Date.now(),
      notes: '',
      subtasks: [],
      ...задача,
    };
    // Пересчитать xpValue если явно передан difficulty
    if (!задача.xpValue) новая.xpValue = this.calcBaseXP(новая.difficulty, новая.quadrant);
    задачи.push(новая);
    this.saveTasks(задачи);
    window._дбHook?.('task', новая);
    return новая;
  },

  // §3.2 — Q4 (eliminate) задачи → Idea Bank через 48ч
  getIdeaBank() { return this.get('ideaBank') || []; },
  saveIdeaBank(arr) { this.set('ideaBank', arr); },
  addToIdeaBank(obj) {
    const arr = this.getIdeaBank();
    const нов = { id:'idea_'+Date.now(), createdAt:new Date().toISOString(), ...obj };
    arr.unshift(нов);
    this.saveIdeaBank(arr);
    window._дбHook?.('idea', нов);
  },
  removeFromIdeaBank(id) {
    this.saveIdeaBank(this.getIdeaBank().filter(x => x.id !== id));
    window._дбHook?.('idea_delete', { id });
  },

  // ── БАЗА ЗНАНИЙ (скрипты, шаблоны, чек-листы) ────────────────────────────────
  getKnowledge() {
    try { const s = JSON.parse(localStorage.getItem('lifeos_knowledge')); if (s?.length) return s; } catch {}
    localStorage.setItem('lifeos_knowledge', JSON.stringify(KNOWLEDGE_SEED));
    return KNOWLEDGE_SEED;
  },
  saveKnowledge(arr) { localStorage.setItem('lifeos_knowledge', JSON.stringify(arr)); },
  addKnowledge(item) {
    const arr = this.getKnowledge();
    arr.unshift({ id: 'kn_' + Date.now(), fav: false, cat: 'Заметки', ...item });
    this.saveKnowledge(arr);
  },
  toggleKnowledgeFav(id) {
    const arr = this.getKnowledge();
    const k = arr.find(x => x.id === id);
    if (k) { k.fav = !k.fav; this.saveKnowledge(arr); }
  },
  deleteKnowledge(id) {
    this.saveKnowledge(this.getKnowledge().filter(x => x.id !== id));
  },

  // Перемещает Q4-задачи старше 48ч в Idea Bank
  sweepQ4toIdeaBank() {
    const задачи = this.getTasks();
    const cutoff = Date.now() - 48 * 3600 * 1000;
    const toMove = задачи.filter(t =>
      t.quadrant === 'eliminate' && !t.done && !t.cancelled &&
      t.createdAt < cutoff
    );
    if (!toMove.length) return 0;
    toMove.forEach(t => {
      this.addToIdeaBank({ text: t.text, cat: t.cat, sourceTaskId: t.id, notes: t.notes });
      t.done = true; t.movedToIdeaBank = true;
      t.completedAt = new Date().toISOString();
    });
    this.saveTasks(задачи);
    return toMove.length;
  },

  // Kanban-статус задачи: 'inbox' | 'working' | 'waiting'
  setKanbanStatus(id, status) {
    return this.updateTask(id, { kanban_status: status });
  },

  // Полное обновление задачи (patch-merge)
  updateTask(id, patch) {
    const задачи = this.getTasks();
    const т = задачи.find(x => x.id === id);
    if (!т) return null;
    Object.assign(т, patch);
    this.saveTasks(задачи);
    window._дбHook?.('task', т);
    return т;
  },

  toggleTask(id) {
    const задачи = this.getTasks();
    const т = задачи.find(x => x.id === id);
    if (т) {
      const сталоВыполненным = !т.done;
      т.done = !т.done;
      т.completedAt = т.done ? new Date().toISOString() : null;
      this.saveTasks(задачи);
      // Начисляем XP за выполнение (XP — только вверх, для уровней)
      if (сталоВыполненным) {
        const профиль = this.getProfile();
        профиль.xp = (профиль.xp || 0) + (т.xpValue || 10);
        this.saveProfile(профиль);
      }
      // Баланс (дофамин-механика) пересчитывается из данных через getBalance()
      window._дбHook?.('task', т);
    }
    return т;
  },

  // ── ДОФАМИН-БАЛАНС (механика GAMECHANGER) ───────────────────────────────────
  // Каталог удовольствий
  getPleasureCatalog()  { return this.get('pleasureCatalog') || ДАННЫЕ.pleasureCatalog; },
  getPleasureLog()      { return this.get('pleasureLog') || []; },

  // Заработано баллов из задач (выполненных)
  getEarned() {
    return this.getTasks()
      .filter(t => t.done)
      .reduce((s, t) => s + (t.xpValue || 10), 0);
  },

  // Потрачено на удовольствия
  getSpent() {
    return this.getPleasureLog().reduce((s, p) => s + (p.cost || 0), 0);
  },

  // Итоговый баланс (может быть < 0 — это сигнал стоп)
  getBalance() {
    return this.getEarned() - this.getSpent();
  },

  // Доля удовольствий (0..1) — если > 0.7 уже зона риска
  getPleasureRatio() {
    const earned = this.getEarned();
    if (!earned) return 0;
    return Math.min(1, this.getSpent() / earned);
  },

  // Статистика за сегодня
  getTodayStats() {
    const сегодня = new Date().toDateString();
    const earned = this.getTasks()
      .filter(t => t.done && new Date(t.completedAt || t.createdAt).toDateString() === сегодня)
      .reduce((s, t) => s + (t.xpValue || 10), 0);
    const spent = this.getPleasureLog()
      .filter(p => new Date(p.at).toDateString() === сегодня)
      .reduce((s, p) => s + (p.cost || 0), 0);
    return { earned, spent, balance: earned - spent };
  },

  // Потратить удовольствие
  потратитьУдовольствие(pleasureId, кастомИмя = null, кастомСтоимость = null) {
    const каталог = this.getPleasureCatalog();
    const элемент = каталог.find(p => p.id === pleasureId) ||
      (кастомИмя ? { id: 'custom', icon:'✨', name: кастомИмя, cost: кастомСтоимость || 10 } : null);
    if (!элемент) return { ok: false, reason: 'Не найдено' };

    const баланс = this.getBalance();
    if (баланс < элемент.cost) {
      return { ok: false, reason: `Нужно ещё ${элемент.cost - баланс} баллов`, balance: баланс };
    }

    const журнал = this.getPleasureLog();
    журнал.unshift({
      id: 'pl_' + Date.now(),
      pleasureId: элемент.id,
      icon: элемент.icon,
      name: элемент.name,
      cost: элемент.cost,
      at: new Date().toISOString(),
    });
    this.set('pleasureLog', журнал.slice(0, 500));

    return { ok: true, balance: баланс - элемент.cost, item: элемент };
  },

  deleteTask(id) {
    const задачи = this.getTasks().filter(x => x.id !== id);
    this.saveTasks(задачи);
    window._дбHook?.('task_delete', { id });
  },

  // Проекты
  getProjects()   { return this.get('projects'); },
  saveProjects(p) { this.set('projects', p); },

  addProject(проект) {
    const проекты = this.getProjects();
    const новый = { id: 'p' + Date.now(), ...проект };
    проекты.push(новый);
    this.saveProjects(проекты);
    window._дбHook?.('project', новый);
  },

  // Люди
  getPeople()     { return this.get('people'); },
  savePeople(p)   { this.set('people', p); },

  addPerson(человек) {
    const люди = this.getPeople();
    люди.push({ id: 'pe' + Date.now(), ...человек });
    this.savePeople(люди);
  },

  // Здоровье
  getHealth()     { return this.get('health'); },
  saveHealth(h)   { this.set('health', h); },

  // Питание
  getNutrition()  { return this.get('nutrition'); },
  saveNutrition(n){ this.set('nutrition', n); },

  // ── Цели КБЖУ из антропометрии (Mifflin-St Jeor TDEE) ────────────────────
  computeNutritionGoals({ weight, height, age, sex = 'male', activity = 1.375, goal = 'maintain' }) {
    const w = +weight || 75, h = +height || 178, a = +age || 30;
    const s = sex === 'female' ? -161 : 5;
    const bmr  = 10 * w + 6.25 * h - 5 * a + s;
    let tdee = bmr * (+activity || 1.375);
    if (goal === 'lose') tdee -= 500;
    if (goal === 'gain') tdee += 400;
    const calories = Math.round(tdee / 10) * 10;
    const protein  = Math.round(w * 2);                       // 2 г/кг
    const fat      = Math.round((calories * 0.25) / 9);       // 25% калорий
    const carbs    = Math.round((calories - protein * 4 - fat * 9) / 4);
    return { caloriesGoal: calories, proteinGoal: protein, fatGoal: fat, carbsGoal: Math.max(0, carbs) };
  },
  saveNutritionGoals(params) {
    const goals = this.computeNutritionGoals(params);
    const n = { ...this.getNutrition(), ...goals, goalsMeta: params };
    this.saveNutrition(n);
    return goals;
  },

  // ── КБЖУ: список блюд за сегодня ─────────────────────────────────────────
  _mealsKey() {
    const d = new Date();
    return `lifeos_meals_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  getMeals() {
    return JSON.parse(localStorage.getItem(this._mealsKey()) || '[]');
  },
  addMeal(meal) {
    const meals = this.getMeals();
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const newMeal = {
      id: crypto?.randomUUID?.() || ('m'+Date.now()),
      time: new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),
      date: dateStr,
      ...meal,
    };
    meals.push(newMeal);
    localStorage.setItem(this._mealsKey(), JSON.stringify(meals));
    this._recalcNutritionFromMeals(meals);
    window._дбHook?.('meal', newMeal);
    return newMeal;
  },
  deleteMeal(id) {
    const meals = this.getMeals().filter(m => m.id !== id);
    localStorage.setItem(this._mealsKey(), JSON.stringify(meals));
    this._recalcNutritionFromMeals(meals);
    window._дбHook?.('meal_delete', { id });
  },
  _recalcNutritionFromMeals(meals) {
    const n = this.getNutrition();
    n.calories = meals.reduce((s, m) => s + (m.calories || 0), 0);
    n.protein  = meals.reduce((s, m) => s + (m.protein  || 0), 0);
    n.fat      = meals.reduce((s, m) => s + (m.fat      || 0), 0);
    n.carbs    = meals.reduce((s, m) => s + (m.carbs    || 0), 0);
    this.saveNutrition(n);
  },
  // Ключ блюд за произвольную дату
  _mealsKeyFor(d) {
    return `lifeos_meals_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  getMealsForDate(d) {
    return JSON.parse(localStorage.getItem(this._mealsKeyFor(d)) || '[]');
  },
  // История за N дней (для графиков): [{date, calories, protein, fat, carbs, water}]
  getNutritionHistory(days = 7) {
    const out = [];
    const todayKey = this._mealsKey();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const meals = this.getMealsForDate(d);
      const sum = (k) => meals.reduce((s, m) => s + (m[k] || 0), 0);
      // Вода сегодня берётся из nutrition, прошлые дни — из снимков если есть
      let water = 0;
      if (this._mealsKeyFor(d) === todayKey) water = this.getNutrition().water || 0;
      else water = JSON.parse(localStorage.getItem('lifeos_water_' + this._mealsKeyFor(d).slice(13)) || '0') || 0;
      out.push({
        date: d, label: ['вс','пн','вт','ср','чт','пт','сб'][d.getDay()],
        calories: sum('calories'), protein: sum('protein'), fat: sum('fat'), carbs: sum('carbs'), water,
      });
    }
    return out;
  },
  // Балл питания 0-100: насколько день сбалансирован относительно целей
  nutritionScore() {
    const n = this.getNutrition();
    const meals = this.getMeals();
    if (!meals.length) return 0;
    const ratio = (val, goal) => {
      if (!goal) return 0;
      const r = val / goal;
      return r <= 1 ? r : Math.max(0, 2 - r); // перебор тоже штрафует
    };
    const cal = ratio(n.calories, n.caloriesGoal || 2200);
    const pro = ratio(n.protein,  n.proteinGoal  || 140);
    const wat = ratio((n.water || 0), (n.waterGoal || 2.5));
    // белок и вода важнее
    const score = (cal * 0.3 + pro * 0.4 + wat * 0.3) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
  },

  // Тренировки
  getWorkouts()   { return this.get('workouts'); },
  getGymDays()    { return this.get('gymDays'); },

  logWorkout(тренировка) {
    const тренировки = this.getWorkouts();
    тренировки.unshift({ id: 'w' + Date.now(), date: new Date().toDateString(), ...тренировка });
    this.set('workouts', тренировки);
    const дни = this.getGymDays();
    const сегодня = new Date().getDay();
    const индекс = сегодня === 0 ? 6 : сегодня - 1;
    дни[индекс] = true;
    this.set('gymDays', дни);
  },

  // Квесты
  getQuests()     { return this.get('quests'); },

  completeQuest(id) {
    const квесты = this.getQuests();
    const к = квесты.find(x => x.id === id);
    if (к && !к.done) { к.done = true; this.set('quests', квесты); return к; }
    return null;
  },

  resetQuest(id) {
    const квесты = this.getQuests();
    const к = квесты.find(x => x.id === id);
    if (к) { к.done = false; this.set('quests', квесты); return к; }
    return null;
  },

  // Авторесет квестов каждый день
  resetDailyQuests() {
    const сегодня = new Date().toDateString();
    const p = this.getProfile();
    if (p.lastQuestReset === сегодня) return;
    const квесты = this.getQuests().map(q => ({ ...q, done: false }));
    this.set('quests', квесты);
    p.lastQuestReset = сегодня;
    this.saveProfile(p);
  },

  // Авторесет питания каждый день: вода → 0, КБЖУ пересчёт из блюд за день,
  // чекбоксы сбрасываются. Цели (caloriesGoal и т.д.) сохраняются.
  resetDailyNutrition() {
    const сегодня = new Date().toDateString();
    const n = this.getNutrition();
    if (n.date === сегодня) {
      // тот же день — просто пересчитываем КБЖУ из реальных блюд
      this._recalcNutritionFromMeals(this.getMeals());
      return;
    }
    // новый день: снимок вчерашней воды (для графиков), затем обнуляем
    if (n.date && n.water) {
      const prev = new Date(n.date);
      const key = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
      localStorage.setItem('lifeos_water_' + key, JSON.stringify(n.water));
    }
    n.water = 0;
    n.supplements = false;
    n.shower = false;
    n.calories = 0; n.protein = 0; n.fat = 0; n.carbs = 0;
    n.date = сегодня;
    this.saveNutrition(n);
    // пересчёт из блюд сегодняшнего дня (обычно 0)
    this._recalcNutritionFromMeals(this.getMeals());
  },

  // Очистка старых данных питания (блюда с фото + снимки воды) старше N дней,
  // чтобы localStorage не упёрся в лимит ~5 МБ. Последние 30 дней храним.
  pruneOldNutritionData(keepDays = 30) {
    try {
      const граница = Date.now() - keepDays * 86400000;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = key && key.match(/^lifeos_(?:meals|water)_(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) continue;
        const ts = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
        if (ts < граница) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      if (toRemove.length) console.log(`[db] очищено старых записей питания: ${toRemove.length}`);
    } catch (e) { console.warn('[db] pruneOldNutritionData:', e.message); }
  },

  // Отменить задачу (не удалять, хранить в аналитике)
  cancelTask(id) {
    const задачи = this.getTasks();
    const т = задачи.find(x => x.id === id);
    if (т) {
      т.cancelled    = true;
      т.done         = true;
      т.cancelledAt  = new Date().toISOString();
      т.completedAt  = т.completedAt || new Date().toISOString(); // для группировки по дате
      this.saveTasks(задачи);
      window._дбHook?.('task', т);
    }
    return т;
  },

  // Профиль / XP
  getProfile()    { return this.get('profile'); },
  saveProfile(p)  { this.set('profile', p); window._дбHook?.('profile', p); },

  // Достижения
  getAchievements()   { return this.get('achievements'); },
  unlockAchievement(key) {
    const достижения = this.getAchievements();
    const д = достижения.find(x => x.key === key);
    if (д && !д.unlocked) {
      д.unlocked = true;
      this.set('achievements', достижения);
      window._дбHook?.('ach', key);
      return д;
    }
    return null;
  },

  // RPG характеристики
  getRpgStats() {
    const шкалы = { ...ДАННЫЕ.rpgStats, ...(this.get('rpgStats') || {}) };
    // Защита: все базовые шкалы должны быть числами
    шкалы.STR = typeof шкалы.STR === 'number' ? шкалы.STR : 62;
    шкалы.VIT = typeof шкалы.VIT === 'number' ? шкалы.VIT : 70;
    шкалы.SOC = typeof шкалы.SOC === 'number' ? шкалы.SOC : 55;
    шкалы.WIS = typeof шкалы.WIS === 'number' ? шкалы.WIS : 48;
    // ENG — динамический: рассчитывается из HRV (clamp 0–100)
    const hrv = this.getHealth().hrv || 60;
    шкалы.ENG = Math.min(100, Math.max(0, Math.round((hrv / 80) * 100)));
    return шкалы;
  },

  // Ежедневная деградация шкал (вызывается при init)
  // STR −5, VIT −8, SOC −4, WIS −3 если прошли сутки
  applyDailyDecay() {
    const сегодня = new Date().toDateString();
    const profile = this.getProfile();
    if (profile.lastDecayDate === сегодня) return; // уже применяли сегодня

    const шкалы = this.get('rpgStats') || ДАННЫЕ.rpgStats;
    const деградация = { STR: 5, VIT: 8, SOC: 4, WIS: 3 }; // ENG — только HRV
    for (const [ключ, убыль] of Object.entries(деградация)) {
      if (ключ in шкалы) {
        шкалы[ключ] = Math.max(0, (шкалы[ключ] || 50) - убыль);
      }
    }
    this.set('rpgStats', шкалы);
    profile.lastDecayDate = сегодня;
    this.saveProfile(profile);
  },

  // Дневник
  getDailyLog()   { return this.get('dailyLog'); },
  saveDailyLog(d) {
    d.lastCheckinDate = new Date().toDateString(); // фиксируем дату чекина
    this.set('dailyLog', d);
    window._дбHook?.('daily', d);
  },
  isCheckinDoneToday() {
    const d = this.get('dailyLog') || {};
    return d.lastCheckinDate === new Date().toDateString();
  },

  // Инбокс (голосовые записи из бота)
  getInbox()      { return this.get('inbox') || []; },
  saveInbox(arr)  { this.set('inbox', arr); },

  // Ожидания CRM (жду от других)
  getExpectations()    { return this.get('expectations') || []; },
  saveExpectations(arr){ this.set('expectations', arr); },
  addExpectation(obj)  {
    const arr = this.getExpectations();
    const нов = { id:'exp_'+Date.now(), status:'pending', createdAt:new Date().toISOString(), ...obj };
    arr.unshift(нов);
    this.saveExpectations(arr);
    window._дбHook?.('expectation', нов);
  },
  closeExpectation(id) {
    const arr = this.getExpectations();
    const e = arr.find(x=>x.id===id);
    if (e) {
      e.status='received'; e.closedAt=new Date().toISOString();
      this.saveExpectations(arr);
      window._дбHook?.('expectation', e);
    }
  },

  // Еженедельный челлендж
  getWeeklyChallenge() { return this.get('weeklyChallenge'); },

  // §3.3 — Циклические чекапы жизни
  getCheckups() {
    const DEFAULTS = [
      { id:'chk_dentist',  emoji:'🦷', name:'Стоматолог',               interval:180, lastDone:null, cat:'Здоровье' },
      { id:'chk_blood',    emoji:'🩸', name:'Анализы крови',             interval:365, lastDone:null, cat:'Здоровье' },
      { id:'chk_cardio',   emoji:'❤️', name:'Кардио / Терапевт',        interval:365, lastDone:null, cat:'Здоровье' },
      { id:'chk_dog',      emoji:'🐕', name:'Обработка собаки от клещей',interval:28,  lastDone:null, cat:'Здоровье' },
      { id:'chk_vision',   emoji:'👁️', name:'Окулист',                   interval:365, lastDone:null, cat:'Здоровье' },
    ];
    const stored = this.get('checkups') || [];
    // Merge: сохраняем lastDone из хранилища, добавляем новые дефолты
    const map = Object.fromEntries(stored.map(c => [c.id, c]));
    return DEFAULTS.map(d => ({ ...d, ...(map[d.id] || {}) }));
  },
  saveCheckups(arr) { this.set('checkups', arr); },
  markCheckupDone(id) {
    const arr = this.getCheckups();
    const c = arr.find(x => x.id === id);
    if (!c) return;
    c.lastDone = new Date().toISOString().split('T')[0];
    this.saveCheckups(arr);
    // Генерируем напоминание-задачу на следующий срок
    const nextDate = new Date(Date.now() + c.interval * 86400000);
    const ymd = nextDate.toISOString().split('T')[0];
    this.addTask({
      text: `${c.emoji} ${c.name}`,
      cat: c.cat,
      quadrant: 'schedule',
      due_date: ymd,
      difficulty: 1,
      notes: `Циклический чекап (каждые ${c.interval} дней)`,
    });
    window.showToast?.(`✅ Записано! Следующий ${c.name}: ${nextDate.toLocaleDateString('ru-RU')}`, 'success');
  },
};
