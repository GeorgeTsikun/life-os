// ── Рантайм-выбор модели для serverless (Vercel) ─────────────────────────────
// Читает config.life_model из Supabase (REST), кэш 60с на тёплый инстанс.
// Фолбэк: process.env.LIFE_MODEL → дефолт. Менять из бота /setmodel, без деплоя.

let _model = process.env.LIFE_MODEL || 'gpt-5.5';
let _ts = 0;

export async function getActiveModel() {
  if (Date.now() - _ts < 60000) return _model;
  _ts = Date.now();
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const r = await fetch(`${url}/rest/v1/config?key=eq.life_model&select=value`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (r.ok) { const d = await r.json(); if (d?.[0]?.value) _model = d[0].value; }
    }
  } catch (e) { /* фолбэк на кэш/env */ }
  return _model;
}
