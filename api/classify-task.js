// ── /api/classify-task — AI-разбор задачи для Mini App ─────────────────────
import { getActiveModel } from './_lib/model.js';
// Принимает {текст}, возвращает классификацию: квадрант, категорию, дату.

import OpenAI from 'openai';

export const config = { maxDuration: 30 };

const сегодня = () => new Date().toISOString().split('T')[0];

const ПРОМТ = () => `Сегодня ${сегодня()}. Часовой пояс пользователя: Москва (UTC+3).

Ты разбираешь короткое описание задачи и возвращаешь структуру.

🔥 ЖЁСТКИЕ ПРАВИЛА:

1. Квадрант:
   • "do"        — важно и срочно (горящий дедлайн, кредитка завтра, провалившийся ответ клиенту)
   • "schedule"  — важно, не срочно (двигает к цели — приложение, стратегия, обучение, отношения)
   • "delegate"  — РУТИНА (быт, посуда, бельё, душ, мусор, мелкие звонки)
   • "eliminate" — не важно и не срочно (скролл, ловушка времени)
   • если неясно — "schedule"

2. Категория (cat) — выбери ОДНУ из 11:
   • "Работа"        — клиенты, контроль, deliverables, бизнес
   • "Контент"       — рилсы, посты, сценарии, съёмки
   • "Эксперименты"  — новые продукты, фичи, своё приложение
   • "Семья"         — партнёр, родители, близкие
   • "Встречи"       — созвоны, нетворкинг, мастермайнд
   • "Быт"           — дом, машина, мелкие покупки, гараж, душ
   • "Стратегия"     — планирование, рефлексия, обзоры
   • "Обучение"      — курсы, книги, разборы
   • "Деньги"        — кредитки, платежи, налоги
   • "Здоровье"      — врачи, чекапы, БАДы
   • "Chill"         — отдых для восстановления

3. Время (если в тексте есть):
   • time:      человекочитаемое — "завтра 14:00", "через час", "пятница утром"
   • start_iso: ISO 8601 с учётом сегодняшней даты — "${(() => { const d=new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; })()}T14:00:00"
   • Если время не указано — оба поля null.

Верни ТОЛЬКО валидный JSON:
{
  "text": "короткое чистое название задачи",
  "quadrant": "do|schedule|delegate|eliminate",
  "cat": "одна из 11",
  "time": "завтра 14:00" или null,
  "start_iso": "2026-06-10T14:00:00" или null,
  "уверенность": 0-100
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен' });

  try {
    const { текст } = req.body || {};
    if (!текст || типика(текст).length < 3) {
      return res.status(400).json({ error: 'Слишком короткий текст' });
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: await getActiveModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ПРОМТ() },
        { role: 'user',   content: текст },
      ],
      temperature: 0.3,
    });

    const разбор = JSON.parse(completion.choices[0].message.content);
    res.status(200).json(разбор);
  } catch (err) {
    console.error('classify-task error:', err);
    res.status(500).json({ error: err.message });
  }
}

function типика(s) { return String(s || '').trim(); }
