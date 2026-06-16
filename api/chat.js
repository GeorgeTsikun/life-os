// ── /api/chat — ежедневный AI-директор ───────────────────────────────────────
import { getActiveModel } from './_lib/model.js';
// Принимает { сообщение, контекст }, возвращает ответ Джорджу

import OpenAI from 'openai';

export const config = { maxDuration: 30 };

const СИСТЕМНЫЙ_ПРОМТ = `Ты — персональный AI-директор Джорджа.
Говоришь прямо, без воды, без льстивых вступлений.
Если что-то идёт не так — говоришь.
Если цели противоречат — указываешь.
Ответы короткие, по делу, максимум 5 предложений если не просили развёрнуто.
Всё на русском. Эмодзи уместно, не много.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });

  try {
    const { сообщение, контекст } = req.body || {};
    if (!сообщение) return res.status(400).json({ error: 'Нет сообщения' });

    const сообщения = [
      { role: 'system', content: СИСТЕМНЫЙ_ПРОМТ },
    ];
    if (контекст) {
      сообщения.push({
        role: 'system',
        content: `Текущее состояние:\n${JSON.stringify(контекст, null, 2)}`,
      });
    }
    сообщения.push({ role: 'user', content: сообщение });

    const openai = new OpenAI({ apiKey });
    const ответ = await openai.chat.completions.create({
      model: await getActiveModel(),
      messages: сообщения,
      max_completion_tokens: 500,
    });

    res.status(200).json({ ответ: ответ.choices[0].message.content });
  } catch (err) {
    console.error('chat error:', err);
    res.status(500).json({ error: err.message || 'Ошибка чата' });
  }
}
