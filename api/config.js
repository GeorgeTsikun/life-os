// ── /api/config — публичные настройки для Mini App ───────────────────────────
// Возвращает SUPABASE_URL и SUPABASE_ANON_KEY (anon-ключ публичный, safe).

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 мин кэш
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    owner: 'george',
  });
}
