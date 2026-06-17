// ── Google Calendar для бота: рефреш токена + создание событий ──────────────

import { createClient } from '@supabase/supabase-js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SUPABASE_URL  = process.env.SUPABASE_URL  || '';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GOOGLE_ID     = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

let supa = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supa = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export const googleАктивен = () => !!(supa && GOOGLE_ID && GOOGLE_SECRET);

let _кэшТокена = null; // { access_token, expires_at_ts }

// ── Получить актуальный access_token (рефреш по необходимости) ──────────────
async function получитьТокен(owner = 'george') {
  if (!googleАктивен()) throw new Error('Google не настроен (нет ENV)');

  // 5-минутный in-memory кэш для access_token чтобы не дёргать Supabase на каждое событие
  if (_кэшТокена && _кэшТокена.expires_at_ts > Date.now() + 60000) {
    return _кэшТокена.access_token;
  }

  const { data, error } = await supa.from('oauth_tokens')
    .select('*').eq('owner', owner).eq('provider', 'google').maybeSingle();
  if (error) throw new Error(`Supabase oauth_tokens: ${error.message}`);
  if (!data) throw new Error('Google не авторизован. Открой /api/google/auth');

  const до_истечения = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (до_истечения > Date.now() + 60000 && data.access_token) {
    _кэшТокена = { access_token: data.access_token, expires_at_ts: до_истечения };
    return data.access_token;
  }

  // Рефрешим
  if (!data.refresh_token) throw new Error('Нет refresh_token, переавторизуйся');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id:     GOOGLE_ID,
      client_secret: GOOGLE_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  const fresh = await res.json();
  if (fresh.error) throw new Error(`Refresh Google: ${fresh.error_description || fresh.error}`);

  const expires_at_ts = Date.now() + (fresh.expires_in - 60) * 1000;
  await supa.from('oauth_tokens').update({
    access_token: fresh.access_token,
    expires_at:   new Date(expires_at_ts).toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('owner', owner).eq('provider', 'google');

  _кэшТокена = { access_token: fresh.access_token, expires_at_ts };
  return fresh.access_token;
}

// ── Получить calendar_id по категории задачи ────────────────────────────────
async function календарьПоКатегории(категория, owner = 'george') {
  if (!supa) return null;
  const { data } = await supa.from('calendar_mapping')
    .select('calendar_id,calendar_name')
    .eq('owner', owner).eq('category', категория).maybeSingle();
  return data || null;
}

// ── Цвета событий Google Calendar по категории ──────────────────────────────
// Используется как fallback если все категории мапятся на один календарь.
// Google поддерживает 11 цветов событий (colorId 1-11)
const ЦВЕТА_ПО_КАТЕГОРИИ = {
  'Работа':       '9',  // Blueberry — синий
  'Контент':      '6',  // Tangerine — оранжевый
  'Эксперименты': '3',  // Grape — фиолетовый
  'Семья':        '4',  // Flamingo — розовый
  'Встречи':      '7',  // Peacock — бирюзовый
  'Быт':          '5',  // Banana — жёлтый
  'Стратегия':    '11', // Tomato — красный
  'Обучение':     '10', // Basil — зелёный
  'Деньги':       '2',  // Sage — мятный зелёный
  'Здоровье':     '8',  // Graphite — серый
  'Chill':        '1',  // Lavender — лавандовый
};

// ── Создать событие в нужном календаре ──────────────────────────────────────
export async function создатьСобытие(задача) {
  if (!googleАктивен()) return { skipped: 'Google не настроен' };
  if (!задача.start_iso) return { skipped: 'нет даты' };

  const маппинг = await календарьПоКатегории(задача.cat || 'Работа');
  if (!маппинг) return { skipped: `категория "${задача.cat}" не примаплена к календарю` };

  try {
    const token = await получитьТокен();
    const isDateOnly = !задача.start_iso.includes('T');
    const startDate = new Date(задача.start_iso);
    const длительностьМин = задача.duration_min || (isDateOnly ? 0 : 60);
    const endDate = new Date(startDate.getTime() + длительностьМин * 60000);

    const описание = [
      задача.notes,
      задача.text && `📝 ${задача.text}`,
      `\n— Создано через LIFE OS бот`,
    ].filter(Boolean).join('\n');

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(маппинг.calendar_id)}/events`;
    const start = isDateOnly ? { date: задача.start_iso } : { dateTime: startDate.toISOString(), timeZone: 'Europe/Moscow' };
    const end   = isDateOnly ? { date: задача.start_iso } : { dateTime: endDate.toISOString(),   timeZone: 'Europe/Moscow' };

    const colorId = ЦВЕТА_ПО_КАТЕГОРИИ[задача.cat];
    const тело = { summary: задача.text || 'Задача', description: описание, start, end };
    if (colorId) тело.colorId = colorId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(тело),
    });
    const event = await res.json();
    if (event.error) throw new Error(event.error.message);

    return {
      ok:    true,
      id:    event.id,
      link:  event.htmlLink,
      календарь: маппинг.calendar_name,
    };
  } catch (err) {
    console.error('[gcal create] ошибка:', err.message);
    return { error: err.message };
  }
}

// ── Чтение событий основного календаря (двусторонний синк) ───────────────────
export async function событияНаДень(дата = new Date()) {
  if (!googleАктивен()) return [];
  try {
    const token = await получитьТокен();
    const start = new Date(дата.getFullYear(), дата.getMonth(), дата.getDate());
    const end = new Date(start.getTime() + 86400000);
    const params = new URLSearchParams({
      timeMin: start.toISOString(), timeMax: end.toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '30',
    });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return (data.items || []).map(e => ({
      summary: e.summary || '(без названия)',
      start: e.start?.dateTime || e.start?.date,
      allDay: !e.start?.dateTime,
    }));
  } catch (err) {
    console.error('[gcal list] ошибка:', err.message);
    return [];
  }
}
