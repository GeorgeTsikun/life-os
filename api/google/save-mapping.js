// ── /api/google/save-mapping — приём JSON и сохранение маппинга в Supabase ──

import { saveMapping } from '../_lib/google.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  try {
    const { mapping } = req.body || {};
    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ error: 'Нет поля mapping' });
    }
    await saveMapping(mapping);
    res.status(200).json({ ok: true, count: Object.keys(mapping).length });
  } catch (err) {
    console.error('save-mapping error:', err);
    res.status(500).json({ error: err.message });
  }
}
