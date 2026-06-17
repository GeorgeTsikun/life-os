// ── /api/google/events — чтение событий календаря (двусторонний синк) ─────────
// GET ?days=1 (по умолчанию сегодня). Возвращает события основного календаря.
import { listEvents } from '../_lib/google.js';

export default async function handler(req, res) {
  try {
    const days = Math.min(14, Math.max(1, parseInt(req.query?.days) || 1));
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + days * 86400000);
    const events = await listEvents({
      calendarId: req.query?.calendarId || 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ events });
  } catch (err) {
    console.error('[google/events]', err);
    res.status(500).json({ error: err.message, events: [] });
  }
}
