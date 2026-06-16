// ── LIFE OS — Цели + подбивка (план/факт/цель) ───────────────────────────────
// Цели живут в KV (kv.key='lifegoals') — без отдельной таблицы. Подбивка читает
// цели + day_log (исторические снимки дней) → % к цели, вероятность в текущем
// темпе и ОДНА рекомендация что менять первым.
import { InlineKeyboard } from 'grammy';
import { getActiveModel } from './model.js';

const MSK = 3 * 3600 * 1000;
const сегодняМСК = () => new Date(Date.now() + MSK).toISOString().split('T')[0];

export async function читатьЦели(supa) {
  const { data } = await supa.from('kv').select('data').eq('owner','george').eq('key','lifegoals').maybeSingle().then(r=>r,()=>({data:null}));
  return Array.isArray(data?.data) ? data.data : [];
}
async function записатьЦели(supa, цели) {
  await supa.from('kv').upsert({ owner:'george', key:'lifegoals', data:цели, updated_at:new Date().toISOString() }, { onConflict:'owner,key' }).then(r=>r,()=>{});
}

// /goal Заголовок | target | unit | deadline(YYYY-MM-DD)
export async function добавитьЦель(supa, строка) {
  const [title, target, unit, deadline] = строка.split('|').map(s=>s.trim());
  if (!title || !target) return null;
  const цели = await читатьЦели(supa);
  const цель = { id:Date.now().toString(36), title, target:Number(target)||0, current:0,
    unit:unit||'', deadline:deadline||'', start:сегодняМСК() };
  цели.push(цель);
  await записатьЦели(supa, цели);
  return цель;
}

// /goalp N value — обновить факт цели №N
export async function обновитьФакт(supa, n, value) {
  const цели = await читатьЦели(supa);
  const ц = цели[n-1];
  if (!ц) return null;
  ц.current = Number(value)||0;
  await записатьЦели(supa, цели);
  return ц;
}

// Метрики одной цели: % к цели, % времени, вероятность (темп = факт% / время%)
function метрики(ц) {
  const pctЦель = ц.target ? Math.min(ц.current / ц.target, 1) : 0;
  let pctВремя = null, темп = null;
  if (ц.deadline && ц.start) {
    const всего = new Date(ц.deadline) - new Date(ц.start);
    const прошло = Date.now() + MSK - new Date(ц.start);
    pctВремя = всего > 0 ? Math.min(Math.max(прошло / всего, 0), 1) : 1;
    // ponytail: линейная экстраполяция темпа; вероятность = clamp(факт%/время%).
    темп = pctВремя > 0.01 ? Math.min(pctЦель / pctВремя, 1) : (pctЦель >= 1 ? 1 : 1);
  }
  return { pctЦель, pctВремя, вероятность: темп };
}

const бар = (p) => { const n = Math.round((p||0)*10); return '█'.repeat(n) + '░'.repeat(10-n); };

export async function отправитьЦели({ bot, supa, ownerTgId }) {
  const цели = await читатьЦели(supa);
  if (!цели.length) return bot.api.sendMessage(ownerTgId,
    '🎯 Целей пока нет.\nДобавь: `/goal Выручка | 1000000 | ₽ | 2026-12-31`', { parse_mode:'Markdown' });
  const строки = цели.map((ц,i)=>{
    const m = метрики(ц);
    return `*${i+1}. ${ц.title}*\n${бар(m.pctЦель)} ${Math.round(m.pctЦель*100)}%  ·  ${ц.current}/${ц.target}${ц.unit?' '+ц.unit:''}${ц.deadline?`\n📅 до ${ц.deadline}`:''}`;
  }).join('\n\n');
  await bot.api.sendMessage(ownerTgId, `🎯 *Цели*\n\n${строки}\n\n_Обновить факт: /goalp N значение_`, { parse_mode:'Markdown' });
}

// /progress — подбивка план/факт/цель + темп недели + 1 рекомендация
export async function подбивка({ bot, supa, openai, ownerTgId, безКэша }) {
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});
  const цели = await читатьЦели(supa);
  if (!цели.length) return отправитьЦели({ bot, supa, ownerTgId });

  // Темп за 7 дней из day_log
  const неделяНазад = new Date(Date.now() + MSK - 7*86400000).toISOString().split('T')[0];
  const { data: дни = [] } = await supa.from('day_log').select('date,done_count,new_count')
    .eq('owner','george').gte('date', неделяНазад).then(r=>r,()=>({data:[]}));
  const сделаноЗаНеделю = (дни||[]).reduce((s,d)=>s+(d.done_count||0)+(d.new_count||0),0);
  const активныхДней = (дни||[]).length;

  const блоки = цели.map((ц,i)=>{
    const m = метрики(ц);
    const статус = m.вероятность==null ? '—' : m.вероятность>=0.95 ? '🟢 в графике' : m.вероятность>=0.6 ? '🟡 отстаём' : '🔴 риск';
    const врем = m.pctВремя!=null ? ` · время ${Math.round(m.pctВремя*100)}%` : '';
    return `*${i+1}. ${ц.title}*\n${бар(m.pctЦель)} факт ${Math.round(m.pctЦель*100)}%${врем}\n${статус}${m.вероятность!=null?` (вероятность ${Math.round(m.вероятность*100)}%)`:''}`;
  }).join('\n\n');

  let рек = '';
  if (openai) {
    const сводка = цели.map(ц=>{ const m=метрики(ц); return `${ц.title}: факт ${Math.round(m.pctЦель*100)}%, время ${m.pctВремя!=null?Math.round(m.pctВремя*100)+'%':'?'}`; }).join('; ');
    try {
      const r = await openai.chat.completions.create({
        model: getActiveModel(),
        messages: [{ role:'user', content:
          `Цели Джорджа (план/факт/время): ${сводка}. За неделю закрыто задач: ${сделаноЗаНеделю} (${активныхДней} активных дней). `+
          `Дай ОДНУ конкретную рекомендацию: что изменить ПЕРВЫМ, чтобы вытянуть самую отстающую цель. 1-2 строки, по делу, как Chief of Staff.` }],
        max_completion_tokens: 160,
      });
      рек = r.choices[0].message.content;
    } catch (e) { console.warn('[progress rec]', e.message); }
  }

  const клав = new InlineKeyboard().webApp('📊 Дашборд', безКэша());
  await bot.api.sendMessage(ownerTgId,
    `📈 *Подбивка целей*\n\n${блоки}\n\n🔥 *Темп недели:* ${сделаноЗаНеделю} задач за ${активныхДней} дн.` +
    (рек ? `\n\n🎯 *Что менять первым:*\n${рек}` : ''),
    { parse_mode:'Markdown', reply_markup:клав }
  ).catch(e=>console.warn('[progress send]', e.message));
}
