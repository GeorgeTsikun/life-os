// ── /api/decompose-project — ИИ разбивает проект на задачи с подзадачами ──────
import { getActiveModel } from './model.js';
import OpenAI from 'openai';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });

  const { name, stage, current, target, existing = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Нет проекта' });

  const prompt = `Ты — стратег Джорджа. Разбей проект на конкретные ВЫПОЛНИМЫЕ задачи с подзадачами (шагами).
Проект: "${name}"${stage ? ` · стадия: ${stage}` : ''}${target ? ` · цель: ${current||0}/${target}` : ''}.
${existing.length ? `Уже есть задачи (не дублируй их): ${existing.slice(0,20).join('; ')}.` : ''}

Дай 4–7 задач, двигающих проект вперёд. У каждой 2–4 подзадачи-шага. Приоритет — действия, приближающие к цели/деньгам. Формулируй как конкретные действия (глагол + объект), без воды.

Верни ТОЛЬКО JSON:
{"tasks":[{"text":"задача","cat":"Работа|Контент|Стратегия|Деньги|Встречи","quadrant":"do|schedule","difficulty":1-5,"subtasks":["шаг 1","шаг 2"]}]}`;

  try {
    const openai = new OpenAI({ apiKey });
    const r = await openai.chat.completions.create({
      model: await getActiveModel(),
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1100,
    });
    const data = JSON.parse(r.choices[0].message.content);
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    res.status(200).json({ tasks });
  } catch (err) {
    console.error('[decompose-project]', err);
    res.status(500).json({ error: err.message });
  }
}
