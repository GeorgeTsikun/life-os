// ── СЛОЙ ДАННЫХ ───────────────────────────────────────────────────────────────
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
  tasks: [
    {id:'t1',text:'Созвон с командой — архитектура VAIB',cat:'Операционка',time:'14:00',quadrant:'do',done:false,xpValue:20,createdAt:Date.now()},
    {id:'t2',text:'Отправить КП клиенту Growise',cat:'Привлечение клиентов',time:'до 17:00',quadrant:'do',done:false,xpValue:15,createdAt:Date.now()},
    {id:'t3',text:'Записать урок по ИИ для клуба',cat:'Развитие',time:'эта нед.',quadrant:'schedule',done:false,xpValue:15,createdAt:Date.now()},
    {id:'t4',text:'Стратегия ИИЗИ на Q3',cat:'Развитие',time:'эта нед.',quadrant:'schedule',done:false,xpValue:25,createdAt:Date.now()},
    {id:'t5',text:'Чекап у терапевта',cat:'Личное',time:'июль',quadrant:'schedule',done:false,xpValue:10,createdAt:Date.now()},
    {id:'t6',text:'Утренняя тренировка',cat:'Эффективность',time:'сегодня',quadrant:'do',done:false,xpValue:15,createdAt:Date.now()},
  ],
  projects: [
    {id:'p1',name:'ИИЗИ Клуб',emoji:'💎',progress:65,target:500000,current:310000,color:'#00F5D4',stage:'Активно',tasksCount:8},
    {id:'p2',name:'VAIB',emoji:'🚀',progress:40,target:300000,current:95000,color:'#7B61FF',stage:'Разработка',tasksCount:12},
    {id:'p3',name:'Growise',emoji:'🌿',progress:80,target:200000,current:165000,color:'#FFD700',stage:'Доставка',tasksCount:5},
    {id:'p4',name:'Smart Stylist AI',emoji:'✨',progress:20,target:0,current:0,color:'#FF6B6B',stage:'Идея',tasksCount:3},
  ],
  people: [
    {id:'pe1',name:'Таня',rel:'Партнёр ❤️',last:'сегодня',commitment:'Ужин в субботу',mine:true,due:'сб',urgency:'soon',border:'#00F5D4',avatar:'👩',notes:''},
    {id:'pe2',name:'Дима (CTO)',rel:'Партнёр 🤝',last:'2 дня',commitment:'Прислать архитектуру VAIB',mine:false,due:'пт',urgency:'urgent',border:'#FF4560',avatar:'👨‍💻',notes:''},
    {id:'pe3',name:'Мама Маргарита',rel:'Семья 👨‍👩‍👦',last:'3 дня',commitment:'Позвонить сегодня',mine:true,due:'сегодня',urgency:'urgent',border:'#FF4560',avatar:'👩‍🦳',notes:''},
    {id:'pe4',name:'Кэшью Картель',rel:'Мастермайнд 🧠',last:'5 дней',commitment:'Встреча в четверг',mine:false,due:'чт',urgency:'soon',border:'#7B61FF',avatar:'👥',notes:''},
    {id:'pe5',name:'Лёха 🦊',rel:'Лучший друг',last:'утро',commitment:'Чекап у ветеринара',mine:true,due:'июль',urgency:'later',border:'rgba(232,237,245,.2)',avatar:'🦊',notes:''},
  ],
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
    water: 1.8,
    waterGoal: 2.5,
    score: 7,
    supplements: true,
    shower: true,
    calories: 2100,
    protein: 120,
    carbs: 240,
    fat: 65,
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
}

// ── ПУБЛИЧНОЕ API ─────────────────────────────────────────────────────────────
export const DB = {
  init() {
    инициализировать();
    this.applyDailyDecay();
    this.resetDailyQuests();
  },

  get(ключ)       { return хранилищеПолучить(ключ) ?? ДАННЫЕ[ключ]; },
  set(ключ, знач) { хранилищеСохранить(ключ, знач); },

  // Задачи
  getTasks()      { return this.get('tasks'); },
  saveTasks(t)    { this.set('tasks', t); },

  addTask(задача) {
    const задачи = this.getTasks();
    const новая = {
      id: 't' + Date.now(),
      xpValue: {do:75, schedule:50, delegate:25, eliminate:25}[задача.quadrant] || 25,
      done: false,
      createdAt: Date.now(),
      notes: '',
      subtasks: [],
      ...задача,
    };
    задачи.push(новая);
    this.saveTasks(задачи);
    window._дбHook?.('task', новая);
    return новая;
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
  saveDailyLog(d) { this.set('dailyLog', d); window._дбHook?.('daily', d); },

  // Инбокс (голосовые записи из бота)
  getInbox()      { return this.get('inbox') || []; },
  saveInbox(arr)  { this.set('inbox', arr); },

  // Еженедельный челлендж
  getWeeklyChallenge() { return this.get('weeklyChallenge'); },
};
