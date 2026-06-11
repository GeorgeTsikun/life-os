// ── /api/google/callback — приём кода, обмен на токены, сохранение ───────────

import { exchangeCodeForTokens, getEnv } from '../_lib/google.js';

export default async function handler(req, res) {
  const { code, error } = req.query || {};
  if (error) return res.status(400).send(`OAuth отменён: ${error}`);
  if (!code) return res.status(400).send('Нет code в запросе');

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      return res.status(400).send(
        '❌ Google не выдал refresh_token. Зайди на Google → my Account → Security → Third-party apps → отзови LIFE OS, и повтори /api/google/auth с prompt=consent'
      );
    }

    const { supaUrl, supaKey } = getEnv();
    const expires_at = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    const upsertRes = await fetch(`${supaUrl}/rest/v1/oauth_tokens?on_conflict=owner,provider`, {
      method: 'POST',
      headers: {
        apikey: supaKey,
        Authorization: `Bearer ${supaKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{
        owner:         'george',
        provider:      'google',
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at,
        scope:         tokens.scope,
        updated_at:    new Date().toISOString(),
      }]),
    });

    if (!upsertRes.ok) {
      const txt = await upsertRes.text();
      throw new Error(`Не удалось сохранить токен в Supabase: ${upsertRes.status} ${txt}`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Google Calendar подключён</title>
  <style>
    body { background:#03030A; color:#E8EDF5; font-family:'Manrope',sans-serif; text-align:center; padding:60px 20px; max-width:500px; margin:0 auto }
    .check { font-size:72px; margin-bottom:24px }
    h1 { font-family:'Orbitron',sans-serif; font-size:24px; color:#00F5D4; margin:0 0 12px }
    p { color:rgba(232,237,245,.65); font-size:14px; line-height:1.6 }
    .btn { display:inline-block; background:linear-gradient(135deg,#00F5D4,#7B61FF); color:#000; padding:14px 28px; border-radius:10px; text-decoration:none; font-weight:700; margin-top:30px }
  </style>
</head>
<body>
  <div class="check">✅</div>
  <h1>GOOGLE CALENDAR ПОДКЛЮЧЁН</h1>
  <p>Refresh token сохранён в облако. Бот теперь может создавать события автоматически.</p>
  <p style="margin-top:20px">Следующий шаг — настройка какая категория задачи в какой календарь попадает.</p>
  <a href="/api/google/calendars" class="btn">→ Настроить маппинг календарей</a>
</body>
</html>`);
  } catch (err) {
    console.error('callback error:', err);
    res.status(500).send(`Ошибка: ${err.message}`);
  }
}
