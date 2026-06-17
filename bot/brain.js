// ── LIFE OS — Второй мозг: поиск + ответ по всей истории ─────────────────────
// RAG-lite: full-text поиск (RPC search_brain) достаёт ~20 релевантных кусочков,
// в ИИ уходят ТОЛЬКО они (≈1k токенов) → ответ со ссылками на источники.
import { InlineKeyboard } from 'grammy';
import { getActiveModel } from './model.js';

export async function искатьВБазе(supa, вопрос, lim = 20) {
  const { data, error } = await supa.rpc('search_brain', { search_q: вопрос, lim });
  if (error) { console.warn('[brain rpc]', error.message); return []; }
  return data || [];
}

export async function вспомнить({ bot, supa, openai, ownerTgId, безКэша }, вопрос) {
  if (!вопрос) return bot.api.sendMessage(ownerTgId, '🧠 Спроси что вспомнить: `/recall что я решал по VAIBE`', { parse_mode:'Markdown' });
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});

  const найдено = await искатьВБазе(supa, вопрос);
  if (!найдено.length)
    return bot.api.sendMessage(ownerTgId, `🤷 По «${вопрос}» в истории ничего не нашёл.\nПопробуй другие ключевые слова.`);

  const фрагменты = найдено.map((r,i)=>`[${i+1}] (${r.source}, ${new Date(r.ts).toLocaleDateString('ru-RU')}) ${r.title}: ${r.snippet}`).join('\n');
  let ответ = '';
  try {
    const r = await openai.chat.completions.create({
      model: getActiveModel(),
      messages: [{ role:'user', content:
        `Вопрос Джорджа: "${вопрос}"\n\nНиже — найденные фрагменты из его базы (история задач/идей/созвонов/дней/людей). Ответь по делу ТОЛЬКО на основе фрагментов, ссылайся на номера [N]. Если данных мало — так и скажи. Кратко, по-русски.\n\nФРАГМЕНТЫ:\n${фрагменты}` }],
      max_completion_tokens: 500,
    });
    ответ = r.choices[0].message.content;
  } catch (e) { console.warn('[brain llm]', e.message); }

  const источники = найдено.slice(0,6).map((r,i)=>`_[${i+1}]_ ${r.source} · ${new Date(r.ts).toLocaleDateString('ru-RU')}`).join('\n');
  const клав = new InlineKeyboard().webApp('🔍 Открыть LIFE OS', безКэша());
  await bot.api.sendMessage(ownerTgId,
    `🧠 *${вопрос}*\n\n${ответ || 'Нашёл фрагменты, но не смог собрать ответ.'}\n\n📎 *Источники:*\n${источники}` +
    (найдено.length>6?`\n_…и ещё ${найдено.length-6}_`:''),
    { parse_mode:'Markdown', reply_markup:клав }
  ).catch(e=>console.warn('[brain send]', e.message));
}
