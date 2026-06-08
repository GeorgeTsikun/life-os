// ── /api/transcribe — расшифровка голоса через Whisper ───────────────────────
// Принимает audio/* в теле запроса, возвращает текст на русском

import OpenAI from 'openai';

export const config = {
  api: { bodyParser: false },     // принимаем сырое аудио
  maxDuration: 60,                 // до 60 сек на запрос (план Vercel Hobby)
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Только POST' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY не настроен в Vercel' });
  }

  try {
    // Собираем сырое тело запроса
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Пустое тело запроса' });
    }

    // Whisper хочет File-подобный объект
    const file = new File([buffer], 'voice.webm', { type: req.headers['content-type'] || 'audio/webm' });

    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ru',
      response_format: 'json',
    });

    res.status(200).json({ text: result.text });
  } catch (err) {
    console.error('transcribe error:', err);
    res.status(500).json({ error: err.message || 'Ошибка распознавания' });
  }
}
