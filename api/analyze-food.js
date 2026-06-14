// api/analyze-food.js — GPT-4o Vision/Text → КБЖУ + ингредиенты + health score
// Принимает либо фото (imageBase64), либо текстовое описание (text).
const MODEL = process.env.FOOD_MODEL || 'gpt-4o';

const PROMPT = `Ты нутрициолог-эксперт. Оцени блюдо и верни КБЖУ.

Верни ТОЛЬКО JSON без markdown:
{
  "name": "Название блюда (на русском)",
  "calories": 000,
  "protein": 00,
  "fat": 00,
  "carbs": 00,
  "weight_g": 000,
  "items": [{ "name": "ингредиент", "calories": 00 }],
  "health_score": 0,
  "confidence": "high|medium|low",
  "note": "Короткий комментарий (1 строка)"
}

Правила:
- calories в ккал, белки/жиры/углеводы в граммах
- items — разбивка по основным ингредиентам с их калориями (2-6 шт)
- health_score — польза блюда 1-10 (10 = максимально полезно)
- Оцени порцию визуально (стандартная тарелка ≈ 300-400г)
- Если блюд несколько — суммируй в name/КБЖУ, детализируй в items
- Если нет еды (на фото/в тексте) — { "error": "Еда не найдена" }`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType = 'image/jpeg', text } = req.body || {};
  if (!imageBase64 && !text) return res.status(400).json({ error: 'imageBase64 или text обязателен' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    // Текстовый режим — описание блюда; фото-режим — Vision
    const content = imageBase64
      ? [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' } },
          { type: 'text', text: PROMPT },
        ]
      : [{ type: 'text', text: `${PROMPT}\n\nОписание блюда от пользователя: "${text}"` }];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI: ${response.status} ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Не удалось распознать ответ');

    const result = JSON.parse(jsonMatch[0]);
    if (result.error) return res.status(422).json({ error: result.error });

    return res.json(result);
  } catch (err) {
    console.error('[analyze-food]', err);
    return res.status(500).json({ error: err.message });
  }
}
