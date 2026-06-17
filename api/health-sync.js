// ── /api/health-sync — приём метрик из Apple Health (iOS Shortcut) ───────────
// Shortcut POST-ит JSON метрик → upsert в health_metrics за сегодня (owner='george').
// Защита простым токеном HEALTH_SYNC_TOKEN (в URL ?token= или заголовке x-health-token).
export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const expected = process.env.HEALTH_SYNC_TOKEN;
  const got = req.headers['x-health-token'] || (req.query && req.query.token);
  if (expected && got !== expected) return res.status(401).json({ error: 'bad token' });

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'SUPABASE env не настроены' });

  const b = req.body || {};
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  // Дата по Москве (Shortcut может не прислать)
  const date = b.date || new Date(Date.now() + 3 * 3600 * 1000).toISOString().split('T')[0];

  // Принимаем как «человеческие» имена из Shortcut, так и готовые колонки
  const row = {
    owner: 'george', date,
    hrv_ms:            num(b.hrv ?? b.hrv_ms),
    resting_hr:        num(b.restingHr ?? b.resting_hr),
    sleep_h:           num(b.sleep ?? b.sleep_h),
    sleep_quality_pct: num(b.sleepQuality ?? b.sleep_quality_pct),
    deep_pct:          num(b.deep ?? b.deep_pct),
    rem_pct:           num(b.rem ?? b.rem_pct),
    steps:             num(b.steps),
    calories_burned:   num(b.calories ?? b.calories_burned),
    km:                num(b.km ?? b.distance),
    move_pct:          num(b.move ?? b.move_pct),
    exercise_pct:      num(b.exercise ?? b.exercise_pct),
    stand_pct:         num(b.stand ?? b.stand_pct),
  };
  // Убираем null, чтобы не затирать уже записанные за день метрики
  Object.keys(row).forEach(k => { if (row[k] === null) delete row[k]; });

  try {
    const r = await fetch(`${supaUrl}/rest/v1/health_metrics?on_conflict=owner,date`, {
      method: 'POST',
      headers: {
        apikey: supaKey, Authorization: `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0,200)}`);
    return res.status(200).json({ ok: true, date, saved: Object.keys(row).length - 2 });
  } catch (err) {
    console.error('[health-sync]', err);
    return res.status(500).json({ error: err.message });
  }
}
