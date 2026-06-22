// ── LIFE OS — Созвон → решения / обязательства / риски ───────────────────────
// Транскрипт встречи → структурный разбор. Мои обязательства → задачи, чужие →
// ожидания (жду от других), всё целиком → таблица meeting_notes (история).
import { InlineKeyboard } from 'grammy';
import { getActiveModel, парсJSONОтвет } from './model.js';
import { записатьСтруктурныйСозвон, notionАктивен } from './notion.js';

const MSK = 3 * 3600 * 1000;
const сегодняМСК = () => new Date(Date.now() + MSK).toISOString().split('T')[0];

export async function разобратьСозвон({ bot, supa, openai, ownerTgId, безКэша }, текст, название = '') {
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});
  const сегодня = сегодняМСК();
  const prompt = `Это транскрипт/заметки созвона Джорджа. Извлеки структуру. Джордж — это "я". Не выдумывай — только то, что реально прозвучало.

ТРАНСКРИПТ: "${текст.slice(0, 8000)}"

Верни ТОЛЬКО JSON:
{
  "title": "короткое название встречи",
  "summary": "2-3 фразы: о чём договорились",
  "decisions": ["принятые решения"],
  "commitments": [{"who":"кто обязался (Джордж / имя)","what":"что сделать","due":"YYYY-MM-DD или ''"}],
  "risks": ["риски/спорные моменты/что может пойти не так"]
}`;

  let r = { title:название, summary:'', decisions:[], commitments:[], risks:[] };
  try {
    const c = await openai.chat.completions.create({
      model: getActiveModel(), response_format: { type:'json_object' },
      messages: [{ role:'user', content: prompt }], max_completion_tokens: 3000,
    });
    const j = парсJSONОтвет(c);
    r.title = название || j.title || 'Созвон';
    r.summary = j.summary || '';
    for (const k of ['decisions','risks']) r[k] = Array.isArray(j[k]) ? j[k] : [];
    r.commitments = Array.isArray(j.commitments) ? j.commitments : [];
  } catch (e) { console.warn('[meeting]', e.message); return bot.api.sendMessage(ownerTgId, `⚠️ Не разобрал созвон: ${e.message}`); }

  // Мои обязательства → задачи; чужие → ожидания
  const мои = r.commitments.filter(c => /джордж|я\b|сам/i.test(c.who||''));
  const чужие = r.commitments.filter(c => !/джордж|я\b|сам/i.test(c.who||''));
  if (мои.length)
    await supa.from('tasks').insert(мои.map(c=>({
      owner:'george', text:c.what, quadrant:'do', cat:'Встречи',
      due_date:c.due||null, xp_value:50,
    }))).then(x=>x,()=>{});
  if (чужие.length)
    await supa.from('expectations').insert(чужие.map(c=>({
      owner:'george', owner_name:c.who||'?', what:c.what,
      deadline:c.due||null, context:r.title, status:'pending',
    }))).then(x=>x,()=>{});

  await supa.from('meeting_notes').insert({
    owner:'george', title:r.title, date:сегодня, summary:r.summary,
    decisions:r.decisions, commitments:r.commitments, risks:r.risks, transcript:текст,
  }).then(x=>x,()=>{});
  // Полная разбивка в Notion (если подключён) — fire-and-forget
  if (notionАктивен()) записатьСтруктурныйСозвон(r).catch(()=>{});

  const блок = (заг, arr, ф) => arr.length ? `\n\n${заг}\n${arr.map(ф).join('\n')}` : '';
  const сообщ = `📝 *${r.title}*` +
    (r.summary ? `\n_${r.summary}_` : '') +
    блок('✅ *Решения:*', r.decisions, d=>`• ${d}`) +
    блок('🤝 *Обязательства:*', r.commitments, c=>`• ${c.who||'?'}: ${c.what}${c.due?` (до ${c.due})`:''}`) +
    блок('⚠️ *Риски:*', r.risks, x=>`• ${x}`) +
    `\n\n_➕ ${мои.length} задач мне · 👀 ${чужие.length} жду от других_`;

  const клав = new InlineKeyboard().webApp('🗓 Задачи', безКэша('?tab=tasks'));
  await bot.api.sendMessage(ownerTgId, сообщ, { parse_mode:'Markdown', reply_markup:клав }).catch(e=>console.warn('[meeting send]', e.message));
}
