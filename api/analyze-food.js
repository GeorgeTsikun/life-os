// api/analyze-food.js — GPT-4o Vision food photo → КБЖУ анализ
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType = 'image/jpeg' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  try {
    const prompt = `Ты нутрициолог-эксперт. Проанализируй блюдо на фото и оцени КБЖУ.

Верни ТОЛЬКО JSON без markdown-блоков:
{
  "name": "Название блюда (на русском)",
  "calories": 000,
  "protein": 00,
  "fat": 00,
  "carbs": 00,
  "weight_g": 000,
  "confidence": "high|medium|low",
  "note": "Короткий комментарий (1 строка)"
}

Правила:
- calories в ккал, остальное в граммах
- Оцени порцию визуально (стандартная тарелка ≈ 300-400г)
- Если блюд несколько — суммируй
- Если нет еды на фото — { "error": "Еда не найдена" }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'low' } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI: ${response.status} ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (strip markdown if present)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Не удалось распознать ответ');

    const result = JSON.parse(jsonMatch[0]);
    if (result.error) return res.status(422).json({ error: result.error });

    return res.json(result);
  } catch (err) {
    console.error('[analyze-food]', err);
    return res.status(500).json({ error: err.message });
  }
}
