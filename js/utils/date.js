// ── ПАРСЕР И ФОРМАТТЕР РУССКИХ ДАТ ────────────────────────────────────────────
// Превращает human-string в Date + умеет красиво форматировать назад

const ДНИ_НЕДЕЛИ = {
  'пн':1, 'пон':1, 'понедельник':1,
  'вт':2, 'втор':2, 'вторник':2,
  'ср':3, 'сред':3, 'среда':3,
  'чт':4, 'четв':4, 'четверг':4,
  'пт':5, 'пятн':5, 'пятница':5,
  'сб':6, 'субб':6, 'суббота':6,
  'вс':0, 'воск':0, 'воскресенье':0,
};

const МЕСЯЦЫ = {
  'январ':1, 'феврал':2, 'март':3, 'апрел':4, 'май':5, 'мая':5,
  'июн':6, 'июл':7, 'август':8, 'сентябр':9, 'октябр':10, 'ноябр':11, 'декабр':12,
};

// ── Парсить русский human-string → Date | null ──────────────────────────────
export function парсДату(стр) {
  if (!стр || typeof стр !== 'string') return null;
  const s = стр.trim().toLowerCase();
  if (!s || s === '—' || s === '-') return null;

  const сейчас = new Date();
  const сегодня = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate(), 9, 0);

  // ISO формат уже — просто парсим
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Простые относительные
  if (s.includes('сегодн'))   return сегодня;
  if (s.includes('завтра'))   { const d = new Date(сегодня); d.setDate(d.getDate()+1); return d; }
  if (s.includes('послезавтра')) { const d = new Date(сегодня); d.setDate(d.getDate()+2); return d; }
  if (s.includes('вчера'))    { const d = new Date(сегодня); d.setDate(d.getDate()-1); return d; }

  // «через час / через 2 часа / через 30 минут / через 3 дня»
  const черезМатч = s.match(/через\s+(\d+|пол|полтора|пару)\s*(час|минут|мин|ден|дн|недел)/);
  if (черезМатч) {
    let n = parseInt(черезМатч[1]);
    if (черезМатч[1] === 'пол') n = 0.5;
    if (черезМатч[1] === 'полтора') n = 1.5;
    if (черезМатч[1] === 'пару') n = 2;
    if (isNaN(n)) n = 1;
    const unit = черезМатч[2];
    const d = new Date(сейчас);
    if (unit.startsWith('час'))  d.setHours(d.getHours() + n);
    else if (unit.startsWith('мин')) d.setMinutes(d.getMinutes() + n);
    else if (unit.startsWith('ден') || unit.startsWith('дн')) d.setDate(d.getDate() + n);
    else if (unit.startsWith('недел')) d.setDate(d.getDate() + n*7);
    return d;
  }

  // Только время «14:00»
  const времяМатч = s.match(/^(\d{1,2}):(\d{2})$/);
  if (времяМатч) {
    const d = new Date(сегодня);
    d.setHours(parseInt(времяМатч[1]), parseInt(времяМатч[2]));
    return d;
  }

  // День недели «пн», «в пятницу», «пт 14:00»
  for (const [имя, dow] of Object.entries(ДНИ_НЕДЕЛИ)) {
    if (s === имя || s.startsWith(имя + ' ') || s.startsWith('в ' + имя) || s.startsWith('во ' + имя)) {
      const d = новаяДатаНа(dow);
      // Если есть время в конце «пт 14:00»
      const времяВ = s.match(/(\d{1,2}):(\d{2})/);
      if (времяВ) d.setHours(parseInt(времяВ[1]), parseInt(времяВ[2]));
      return d;
    }
  }

  // «15 июля», «3 декабря»
  const месМатч = s.match(/(\d{1,2})\s+(\p{L}+)/u);
  if (месМатч) {
    const день = parseInt(месМатч[1]);
    const месСтр = месМатч[2].toLowerCase();
    for (const [имя, м] of Object.entries(МЕСЯЦЫ)) {
      if (месСтр.startsWith(имя)) {
        const год = сейчас.getFullYear();
        const d = new Date(год, м-1, день, 9, 0);
        // Если дата уже прошла в этом году — берём следующий
        if (d < сейчас) d.setFullYear(год + 1);
        return d;
      }
    }
  }

  // «утром / днём / вечером / ночью» — на сегодня в дефолт-час
  if (s === 'утром') { const d = new Date(сегодня); d.setHours(8); return d; }
  if (s === 'днём' || s === 'днем') { const d = new Date(сегодня); d.setHours(13); return d; }
  if (s === 'вечером') { const d = new Date(сегодня); d.setHours(19); return d; }
  if (s === 'ночью') { const d = new Date(сегодня); d.setHours(22); return d; }

  // «эта нед.», «след. нед.», «месяц» — null, попадёт в бакет «без даты»
  return null;
}

// ── Получить дату ближайшего дня недели вперёд ──────────────────────────────
function новаяДатаНа(dow) {
  const сейчас = new Date();
  const сегодня = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate(), 9, 0);
  const текущийDow = сегодня.getDay();
  let дельта = dow - текущийDow;
  if (дельта <= 0) дельта += 7;
  сегодня.setDate(сегодня.getDate() + дельта);
  return сегодня;
}

// ── Бакет: к какой группе принадлежит дата ──────────────────────────────────
export function бакет(дата) {
  if (!дата) return 'noDate';
  const d = (дата instanceof Date) ? дата : new Date(дата);
  if (isNaN(d.getTime())) return 'noDate';

  const сейчас = new Date();
  const сегодня = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate());
  const завтра = new Date(сегодня); завтра.setDate(завтра.getDate()+1);
  const послезавтра = new Date(сегодня); послезавтра.setDate(послезавтра.getDate()+2);
  const черезНеделю = new Date(сегодня); черезНеделю.setDate(черезНеделю.getDate()+7);

  const ддата = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (ддата < сегодня)   return 'overdue';
  if (+ддата === +сегодня) return 'today';
  if (+ддата === +завтра)  return 'tomorrow';
  if (ддата < черезНеделю) return 'thisWeek';
  return 'later';
}

// ── Красиво напечатать дату ─────────────────────────────────────────────────
export function форматДата(дата, опции = {}) {
  if (!дата) return '';
  const d = (дата instanceof Date) ? дата : new Date(дата);
  if (isNaN(d.getTime())) return '';

  const сейчас = new Date();
  const сегодня = new Date(сейчас.getFullYear(), сейчас.getMonth(), сейчас.getDate());
  const ддата = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const разн = Math.round((ддата - сегодня) / 86400000);

  const часы = d.getHours();
  const минуты = d.getMinutes();
  const временеЕсть = (часы !== 0 || минуты !== 0) && !(часы === 9 && минуты === 0);
  const часовStr = временеЕсть ? `${часы}:${String(минуты).padStart(2,'0')}` : '';

  const бак = бакет(d);

  let основа;
  if (бак === 'overdue') основа = разн === -1 ? 'вчера' : `${-разн} дн. назад`;
  else if (разн === 0) основа = 'сегодня';
  else if (разн === 1) основа = 'завтра';
  else if (разн < 7)   основа = ДНИ_СОКР[d.getDay()];
  else                 основа = `${d.getDate()} ${МЕС_СОКР[d.getMonth()]}`;

  return опции.compact
    ? (часовStr ? `${основа} ${часовStr}` : основа)
    : (часовStr ? `${основа} ${часовStr}` : основа);
}

const ДНИ_СОКР = ['вс','пн','вт','ср','чт','пт','сб'];
const МЕС_СОКР = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

// ── Бакет для UI: эмодзи + цвет + заголовок ──────────────────────────────────
export const БАКЕТЫ_UI = {
  overdue:  { label:'🔥 ПРОСРОЧЕНО',  color:'#FF4560', sub:'Разобрать срочно' },
  today:    { label:'⚡ СЕГОДНЯ',     color:'#FFD700', sub:'Сделать сегодня' },
  tomorrow: { label:'📅 ЗАВТРА',     color:'#00C9FF', sub:'На завтра' },
  thisWeek: { label:'📆 НА НЕДЕЛЕ',  color:'#00F5D4', sub:'Ближайшие дни' },
  later:    { label:'🗓️ ПОЗЖЕ',      color:'#7B61FF', sub:'Через неделю+' },
  noDate:   { label:'∞ БЕЗ ДАТЫ',    color:'rgba(232,237,245,.35)', sub:'Когда-нибудь' },
};

export const ПОРЯДОК_БАКЕТОВ = ['overdue','today','tomorrow','thisWeek','later','noDate'];

// ── ISO дата (для Supabase) ──────────────────────────────────────────────────
export function вISO(дата) {
  if (!дата) return null;
  const d = (дата instanceof Date) ? дата : new Date(дата);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function вДатуISO(дата) {
  if (!дата) return null;
  const d = (дата instanceof Date) ? дата : new Date(дата);
  if (isNaN(d.getTime())) return null;
  // ВАЖНО: используем ЛОКАЛЬНЫЕ компоненты, не UTC, чтобы дата не сдвигалась
  const год = d.getFullYear();
  const мес = String(d.getMonth() + 1).padStart(2, '0');
  const ден = String(d.getDate()).padStart(2, '0');
  return `${год}-${мес}-${ден}`;
}

// Date → "YYYY-MM-DDTHH:MM" для datetime-local input (ЛОКАЛЬНОЕ время)
export function вЛокальнуюФорму(дата) {
  if (!дата) return '';
  const d = (дата instanceof Date) ? дата : new Date(дата);
  if (isNaN(d.getTime())) return '';
  const год = d.getFullYear();
  const мес = String(d.getMonth() + 1).padStart(2, '0');
  const ден = String(d.getDate()).padStart(2, '0');
  const ч = String(d.getHours()).padStart(2, '0');
  const мин = String(d.getMinutes()).padStart(2, '0');
  return `${год}-${мес}-${ден}T${ч}:${мин}`;
}
