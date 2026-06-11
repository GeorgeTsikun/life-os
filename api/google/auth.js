// ── /api/google/auth — старт OAuth-флоу: редирект на Google ──────────────────

const REDIRECT_URI = 'https://life-os-chi-rose.vercel.app/api/google/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

export default function handler(req, res) {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  if (!client_id) {
    return res.status(500).send('GOOGLE_CLIENT_ID не настроен в Vercel');
  }

  const params = new URLSearchParams({
    client_id,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPE,
    access_type:   'offline',          // нужно для refresh_token
    prompt:        'consent',          // принудительный экран — чтобы выдали refresh даже если уже авторизовывался
    include_granted_scopes: 'true',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
