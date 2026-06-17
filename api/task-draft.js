// ── /api/task-draft — ИИ-агент: делает черновик задачи (10-70% готовности) ────
// По тексту задачи генерит готовый черновик (письмо/план/текст), шаги и — если
// непонятно — уточняющие вопросы. Задача открывается уже наполовину сделанной.
import { getActiveModel } from './_lib/model.js';
import OpenAI from 'openai';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });

  const { text, cat, notes, project } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Нет задачи' });

  const prompt = `Ты — ИИ-ассистент Джорджа (предприниматель, ИИЗИ VAIBE, фокус — деньги/продажи/контент). Тебе дали задачу. Сделай за него ЧЕРНОВУЮ часть, чтобы он открыл задачу уже наполовину готовой.

ЗАДАЧА: "${text}"${cat ? `\nКатегория: ${cat}` : ''}${project ? `\nПроект: ${project}` : ''}${notes ? `\nЗаметки: ${notes}` : ''}

Определи тип (письмо/сообщение/план/текст/контент/исследование/звонок) и выдай:
- draft: готовый черновик (само письмо/пост/план/скрипт — то, что можно сразу использовать/допилить). Если задача нетекстовая (напр. «позвонить») — дай план разговора/чеклист.
- steps: 3-6 конкретных шагов выполнения (короткие).
- questions: 0-3 уточняющих вопроса, ТОЛЬКО если без ответа никак. Если всё ясно — пустой массив.

Пиши по-русски, по делу, в тоне Джорджа (прямо, без воды). Верни ТОЛЬКО JSON:
{"draft":"...","steps":["..."],"questions":["..."]}`;

  try {
    const openai = new OpenAI({ apiKey });
    const r = await openai.chat.completions.create({
      model: await getActiveModel(),
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1200,
    });
    const data = JSON.parse(r.choices[0].message.content);
    res.status(200).json({
      draft: data.draft || '',
      steps: Array.isArray(data.steps) ? data.steps : [],
      questions: Array.isArray(data.questions) ? data.questions : [],
    });
  } catch (err) {
    console.error('[task-draft]', err);
    res.status(500).json({ error: err.message });
  }
}
