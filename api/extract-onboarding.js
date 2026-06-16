// ── /api/extract-onboarding — превращаем голос в структуру LIFE OS ───────────
// Принимает { ответы: {...} }, возвращает полную структуру данных для приложения

import OpenAI from 'openai';

export const config = { maxDuration: 60 };

const СИСТЕМНЫЙ_ПРОМТ = `Ты — AI-директор по жизни. Пользователь рассказал о себе в 7 блоках.
Извлеки структурированные данные для персональной ОС жизни.

ВАЖНО:
- Все строки на русском
- Эмодзи живые, тематические
- Задачи распределяй по матрице Эйзенхауэра (do=важно+срочно, schedule=важно+несрочно, delegate=неважно+срочно, eliminate=неважно+несрочно)
- RPG-характеристики (STR/VIT/INT/CHA/WIS/FOC) оценивай 30-95 по тому что услышал
- Если данных мало — заполни разумным значением по умолчанию

Верни ТОЛЬКО валидный JSON в формате:
{
  "profile": {"name":"...", "tagline":"...", "avatar":"эмодзи"},
  "projects": [{"name":"...","emoji":"...","target":число_в_рублях,"current":число,"progress":0-100,"color":"#hex","stage":"Идея|Разработка|Активно|Доставка","tasksCount":число}],
  "tasks": [{"text":"...","cat":"Бизнес|Деньги|Клуб|Стратегия|Здоровье|Контент|Юрид.|Семья|Личное","time":"...","quadrant":"do|schedule|delegate|eliminate"}],
  "people": [{"name":"...","rel":"...эмодзи","commitment":"...","mine":bool,"due":"...","urgency":"urgent|soon|later","avatar":"эмодзи","notes":"контекст"}],
  "quests": [{"title":"...","icon":"эмодзи","xp":150}],
  "weeklyChallenge": {"title":"...","target":число,"xp":500,"emoji":"⚡"},
  "rpgStats": {"STR":число,"VIT":число,"INT":число,"CHA":число,"WIS":число,"FOC":число},
  "dailyLog": {"energy":1-10,"mood":"эмодзи","focus":часов_в_день,"note":"..."}
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Только POST' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY не настроен в Vercel' });

  try {
    const { ответы } = req.body || {};
    if (!ответы || Object.keys(ответы).length === 0) {
      return res.status(400).json({ error: 'Нет ответов' });
    }

    // Формируем единый текст
    const пользователь = Object.entries(ответы)
      .map(([блок, текст]) => `[${блок}]\n${текст}`)
      .join('\n\n');

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.LIFE_MODEL || 'gpt-5.5',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: СИСТЕМНЫЙ_ПРОМТ },
        { role: 'user',   content: пользователь },
      ],
      temperature: 0.7,
    });

    const структура = JSON.parse(completion.choices[0].message.content);
    res.status(200).json({ структура });
  } catch (err) {
    console.error('extract error:', err);
    res.status(500).json({ error: err.message || 'Ошибка извлечения' });
  }
}
