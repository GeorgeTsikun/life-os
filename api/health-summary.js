// ── /api/health-summary — AI-анализ здоровья ─────────────────────────────────
import { getActiveModel } from './_lib/model.js';
// Принимает данные здоровья, возвращает короткий вывод + рекомендации.

import OpenAI from 'openai';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });

  const { health, profile, rc } = req.body || {};
  if (!health) return res.status(400).json({ error: 'Нет данных' });

  const prompt = `Ты персональный AI-врач-биохакер. Анализируй данные здоровья и дай короткий (3-4 предложения) русскоязычный вывод + 2-3 конкретных рекомендации.

Данные:
- HRV: ${health.hrv || '—'} мс (норма 50-80, история: ${(health.hrvData||[]).slice(-5).join(', ')})
- Пульс покоя: ${health.restingHr || '—'} уд/мин
- Сон: ${health.sleep?.hours || '—'}ч, качество ${health.sleep?.quality || '—'}%, глубокий ${health.sleep?.deep || '—'}%, REM ${health.sleep?.rem || '—'}%
- Шаги: ${health.steps || '—'} (цель 10000)
- RC сегодня: ${rc?.value?.toFixed(2) || '—'} (${rc?.label || '—'})
- Уровень: ${profile?.level || 1}, стрик: ${profile?.streak || 0} дней

Верни ТОЛЬКО валидный JSON:
{
  "status": "отлично|хорошо|норма|тревога",
  "summary": "2-3 предложения о состоянии",
  "tips": ["совет 1", "совет 2", "совет 3"],
  "color": "#00E396|#FFD700|#FF9F43|#FF4560"
}`;

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: await getActiveModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Проанализируй и дай вывод.' },
      ],
      temperature: 0.5,
    });
    const result = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(result);
  } catch (err) {
    console.error('health-summary error:', err);
    res.status(500).json({ error: err.message });
  }
}
