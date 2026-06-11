// ── Хелпер Google OAuth — обновление токенов, создание событий ──────────────

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REDIRECT_URI = 'https://life-os-chi-rose.vercel.app/api/google/callback';

export function getEnv() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!id || !secret) throw new Error('GOOGLE_CLIENT_ID/SECRET не настроены в Vercel');
  if (!supaUrl || !supaKey) throw new Error('SUPABASE_URL/SERVICE_ROLE_KEY не настроены');
  return { id, secret, supaUrl, supaKey };
}

// ── Прямой REST к Supabase (без библиотеки supabase-js) ──────────────────────
async function supaSelect(supaUrl, supaKey, путь) {
  const res = await fetch(`${supaUrl}/rest/v1/${путь}`, {
    headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${путь}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supaUpsert(supaUrl, supaKey, таблица, тело, conflict = 'id') {
  const res = await fetch(`${supaUrl}/rest/v1/${таблица}?on_conflict=${conflict}`, {
    method: 'POST',
    headers: {
      apikey: supaKey,
      Authorization: `Bearer ${supaKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(Array.isArray(тело) ? тело : [тело]),
  });
  if (!res.ok) throw new Error(`Supabase UPSERT ${таблица}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Обмен code на токены (callback flow) ─────────────────────────────────────
export async function exchangeCodeForTokens(code) {
  const { id, secret } = getEnv();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error(`Google: ${tokens.error_description || tokens.error}`);
  return tokens;
}

// ── Получить актуальный access_token (рефреш если нужно) ─────────────────────
export async function getAccessToken(owner = 'george') {
  const { id, secret, supaUrl, supaKey } = getEnv();

  const список = await supaSelect(
    supaUrl, supaKey,
    `oauth_tokens?owner=eq.${owner}&provider=eq.google&select=*&limit=1`
  );
  const запись = список[0];
  if (!запись) throw new Error('Не авторизован в Google. Зайди на /api/google/auth');

  // Если токен ещё свежий — возвращаем
  if (запись.expires_at && new Date(запись.expires_at) > new Date(Date.now() + 60000)) {
    return запись.access_token;
  }

  // Иначе — рефрешим
  if (!запись.refresh_token) {
    throw new Error('Refresh token отсутствует. Пройди авторизацию заново.');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: запись.refresh_token,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  });
  const fresh = await res.json();
  if (fresh.error) throw new Error(`Refresh Google: ${fresh.error_description || fresh.error}`);

  const expires_at = new Date(Date.now() + (fresh.expires_in - 60) * 1000).toISOString();
  await supaUpsert(supaUrl, supaKey, 'oauth_tokens', {
    owner, provider: 'google',
    access_token: fresh.access_token,
    refresh_token: fresh.refresh_token || запись.refresh_token,
    expires_at,
    scope: fresh.scope || запись.scope,
    updated_at: new Date().toISOString(),
  }, 'owner,provider');
  return fresh.access_token;
}

// ── Создать событие в выбранном календаре ────────────────────────────────────
export async function createEvent({ calendarId, summary, description, startISO, endISO, timeZone = 'Europe/Moscow' }) {
  const token = await getAccessToken();
  const isDateOnly = !startISO.includes('T');

  const start = isDateOnly ? { date: startISO } : { dateTime: startISO, timeZone };
  const end   = isDateOnly ? { date: endISO   } : { dateTime: endISO,   timeZone };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, description, start, end }),
    }
  );
  const event = await res.json();
  if (event.error) throw new Error(`Create event: ${event.error.message}`);
  return event;
}

// ── Список календарей пользователя ───────────────────────────────────────────
export async function listCalendars() {
  const token = await getAccessToken();
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50&showHidden=false',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(`List calendars: ${data.error.message}`);
  return (data.items || []).map(c => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    backgroundColor: c.backgroundColor,
    accessRole: c.accessRole,
  }));
}

// ── Загрузить текущий маппинг категория → calendar_id ────────────────────────
export async function loadMapping(owner = 'george') {
  const { supaUrl, supaKey } = getEnv();
  const список = await supaSelect(
    supaUrl, supaKey,
    `calendar_mapping?owner=eq.${owner}&select=*`
  );
  return Object.fromEntries(список.map(m => [m.category, m]));
}

// ── Сохранить маппинг ────────────────────────────────────────────────────────
export async function saveMapping(маппинг, owner = 'george') {
  const { supaUrl, supaKey } = getEnv();
  const рows = Object.entries(маппинг).map(([category, info]) => ({
    owner, category,
    calendar_id:   info.calendar_id,
    calendar_name: info.calendar_name,
    color:         info.color || null,
    updated_at:    new Date().toISOString(),
  }));
  if (рows.length === 0) return;
  await supaUpsert(supaUrl, supaKey, 'calendar_mapping', рows, 'owner,category');
}
