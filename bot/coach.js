// ── LIFE OS — AI-коуч дня (Chief of Staff) ───────────────────────────────────
// Знает контекст (проекты/задачи/финансы/здоровье) → утром спрашивает план →
// генерит ПЛОТНЫЙ распорядок по часам → создаёт задачи с временем → шлёт в чат.
import { InlineKeyboard } from 'grammy';
import { getActiveModel } from './model.js';
import { читатьЦели } from './goals.js';

const MSK = 3 * 3600 * 1000;
const сегодняМСК = () => new Date(Date.now() + MSK).toISOString().split('T')[0];
const завтраМСК = () => new Date(Date.now() + 86400000 + MSK).toISOString().split('T')[0];

// ── Сбор контекста жизни для мозга ───────────────────────────────────────────
export async function собратьКонтекст(supa) {
  if (!supa) return 'нет данных';
  const сегодня = сегодняМСК();
  const [pr, tk, exp, fin, hm] = await Promise.all([
    supa.from('projects').select('name,stage,progress,current,target').eq('owner','george').then(r=>r,()=>({data:[]})),
    supa.from('tasks').select('text,quadrant,cat,due_date,defer_count').eq('owner','george').eq('done',false).eq('cancelled',false).limit(40).then(r=>r,()=>({data:[]})),
    supa.from('expectations').select('what,owner_name,deadline').eq('owner','george').eq('status','pending').limit(8).then(r=>r,()=>({data:[]})),
    supa.from('finance').select('data').eq('owner','george').maybeSingle().then(r=>r,()=>({data:null})),
    supa.from('health_metrics').select('hrv_ms,sleep_h').eq('owner','george').order('date',{ascending:false}).limit(1).maybeSingle().then(r=>r,()=>({data:null})),
  ]);
  const проекты = (pr.data||[]).map(p=>`• ${p.name} (${p.stage||'—'}, ${p.progress||0}%)`).join('\n') || 'нет';
  const q1 = (tk.data||[]).filter(t=>t.quadrant==='do').map(t=>`⚡ ${t.text}`);
  const q2 = (tk.data||[]).filter(t=>t.quadrant==='schedule').map(t=>`🏔 ${t.text}`);
  const задачи = [...q1, ...q2].slice(0,15).join('\n') || 'нет открытых задач';
  const ожидания = (exp.data||[]).map(e=>`• ${e.what} ← ${e.owner_name||'?'}`).join('\n') || 'нет';
  let деньги = 'нет данных';
  if (fin.data?.data) {
    const f = fin.data.data;
    const горящие = (f.payments||[]).filter(p=>p.status!=='paid'&&(p.dueIn===0||p.dueIn===1)).map(p=>p.title);
    const лиды = (f.leads||[]).filter(l=>l.hot&&l.status!=='contacted').map(l=>l.name);
    деньги = `цель ${f.incomeGoal||'?'}/мес; горящие платежи: ${горящие.join(', ')||'—'}; написать лидам: ${лиды.slice(0,5).join(', ')||'—'}`;
  }
  const здоровье = hm.data ? `HRV ${hm.data.hrv_ms||'?'}мс, сон ${hm.data.sleep_h||'?'}ч` : 'нет данных';
  const целиМассив = await читатьЦели(supa).catch(()=>[]);
  const цели = целиМассив.length
    ? целиМассив.map(ц=>`• ${ц.title}: ${ц.current}/${ц.target}${ц.unit?' '+ц.unit:''}${ц.deadline?` (до ${ц.deadline})`:''}`).join('\n')
    : 'не заданы';
  return `Сегодня ${сегодня} (Москва).
ЦЕЛИ:\n${цели}
ПРОЕКТЫ:\n${проекты}
ОТКРЫТЫЕ ЗАДАЧИ:\n${задачи}
ЖДУ ОТ ДРУГИХ:\n${ожидания}
ДЕНЬГИ: ${деньги}
ЗДОРОВЬЕ: ${здоровье}`;
}

// ── Генерация плана дня по часам ─────────────────────────────────────────────
export async function сгенерироватьПлан(openai, supa, доп = '') {
  const контекст = await собратьКонтекст(supa);
  const prompt = `Ты — AI Chief of Staff Джорджа (предприниматель, фрилансер, фокус — деньги и ключевые проекты ИИЗИ VAIBE).
На основе КОНТЕКСТА и реплики составь ПЛОТНЫЙ реалистичный распорядок дня 09:00–20:00.
Приоритет №1 — действия, приносящие деньги (продажи, написать тёплым клиентам, контент, упаковка услуг). Вставь обед, прогулку, тренировку, паузы. Блоки 30–120 мин, без пустот.

КОНТЕКСТ:\n${контекст}

РЕПЛИКА ДЖОРДЖА (что ещё в планах): ${доп || '(не дал — спланируй сам по контексту)'}

Верни ТОЛЬКО JSON:
{"blocks":[{"start":"09:00","end":"10:30","title":"...","cat":"Работа|Контент|Деньги|Встречи|Здоровье|Стратегия|Быт|Chill","focus":true|false}],"note":"1 фраза мотивации/фокуса"}`;
  const r = await openai.chat.completions.create({
    model: getActiveModel(),
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 900,
  });
  const data = JSON.parse(r.choices[0].message.content);
  data.blocks = Array.isArray(data.blocks) ? data.blocks : [];
  return data;
}

// ── Создание задач из блоков + отправка плана ────────────────────────────────
export async function отправитьПлан({ bot, supa, openai, ownerTgId, безКэша }, доп = '', { дата, заголовок } = {}) {
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});
  let план;
  try { план = await сгенерироватьПлан(openai, supa, доп); }
  catch (e) { return bot.api.sendMessage(ownerTgId, `⚠️ Не смог составить план: ${e.message}`); }
  if (!план.blocks.length) return bot.api.sendMessage(ownerTgId, '🤷 Не получилось составить план. Скажи пару задач — и я соберу.');

  const сегодня = дата || сегодняМСК();
  // Создаём задачи с временем (попадут в расписание Mini App + напоминания бота)
  if (supa) {
    const строки = план.blocks.map(b => ({
      owner: 'george',
      text: b.title,
      quadrant: b.focus ? 'do' : 'schedule',
      cat: b.cat || 'Работа',
      time_label: b.start || null,
      start_iso: b.start ? `${сегодня}T${b.start}:00` : null,
      due_date: сегодня,
      xp_value: b.focus ? 75 : 50,
      duration_min: 60,
    }));
    await supa.from('tasks').insert(строки).then(r=>r,()=>{});
  }

  const иконкаКат = { Работа:'💼', Контент:'🎬', Деньги:'💰', Встречи:'🤝', Здоровье:'💪', Стратегия:'🧭', Быт:'🏠', Chill:'🌴' };
  const строкиТекст = план.blocks.map(b =>
    `*${b.start}–${b.end||''}* ${b.focus?'🔥 ':''}${иконкаКат[b.cat]||'•'} ${b.title}`).join('\n');
  const клав = new InlineKeyboard()
    .text('🔁 Перегенерировать', 'coach:gen').row()
    .webApp('🗓 Открыть план', безКэша('?tab=tasks'));
  await bot.api.sendMessage(ownerTgId,
    `🗓 *${заголовок || 'Твой план на сегодня'}* (${план.blocks.length} блоков)\n\n${строкиТекст}\n\n_${план.note || 'Погнали. Деньги — топ-1.'}_\n\n✅ Блоки добавлены в задачи — напомню по времени.`,
    { parse_mode: 'Markdown', reply_markup: клав }
  ).catch(e => console.warn('[coach send]', e.message));
}

// ── Вечер: УНИВЕРСАЛЬНЫЙ разбор свободного рассказа о дне ──────────────────────
// Один рассказ (текст/голос) → коуч сам раскидывает по всему дашборду:
// закрывает/переносит задачи, фиксирует сделанное вне списка, еду+КБЖУ, воду,
// идеи; сохраняет исторический снимок дня (day_log) и собирает план на завтра.
export async function вечернийРазбор({ bot, supa, openai, ownerTgId, безКэша }, текст) {
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});
  const сегодня = сегодняМСК();
  const { data: задачи = [] } = await supa.from('tasks')
    .select('id,text,defer_count').eq('owner','george').eq('done',false).eq('cancelled',false)
    .or(`due_date.eq.${сегодня},quadrant.eq.do`).limit(40)
    .then(r=>r,()=>({data:[]}));

  const список = задачи.map(з=>`${з.id}\t${з.text}`).join('\n') || '(нет открытых задач)';
  const prompt = `Ты — AI Chief of Staff Джорджа. Он рассказывает свободным текстом, как прошёл день: что делал, что ел/пил, что придумал. Разложи рассказ по полочкам. Не выдумывай — фиксируй только то, что реально сказано.

ОТКРЫТЫЕ ЗАДАЧИ (id<TAB>текст):\n${список}

РАССКАЗ ДЖОРДЖА: "${текст}"

Верни ТОЛЬКО JSON:
{
  "done": ["id задач из списка, которые он СДЕЛАЛ"],
  "moved": ["id задач из списка, которые НЕ сделал/переносит"],
  "new_done": ["короткий текст дела, которое он сделал, но его НЕ было в списке задач"],
  "meals": [{"name":"что съел/выпил","meal_type":"breakfast|lunch|dinner|snack","calories":0,"protein":0,"fat":0,"carbs":0}],
  "water_ml": 0,
  "ideas": ["идея/мысль на будущее, если озвучил"],
  "note": "итог дня одной живой фразой от коуча (оценка + что подтянуть завтра)"
}
КБЖУ для meals оцени как нутрициолог по описанию. water_ml — только чистая вода/чай в мл (стакан≈250). Пустые массивы если ничего нет.`;

  let p = { done:[], moved:[], new_done:[], meals:[], water_ml:0, ideas:[], note:'' };
  try {
    const r = await openai.chat.completions.create({
      model: getActiveModel(), response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }], max_completion_tokens: 700,
    });
    const j = JSON.parse(r.choices[0].message.content);
    for (const k of ['done','moved','new_done','meals','ideas']) p[k] = Array.isArray(j[k]) ? j[k] : [];
    p.water_ml = Number(j.water_ml) || 0;
    p.note = j.note || '';
  } catch (e) { console.warn('[вечерний разбор]', e.message); }

  const завтра = завтраМСК();
  const сейчасISO = new Date().toISOString();
  const времяМСК = new Date(Date.now()+MSK).toISOString().slice(11,16);

  // 1. Закрыть существующие задачи
  if (p.done.length)
    await supa.from('tasks').update({ done:true, completed_at:сейчасISO }).in('id', p.done).then(r=>r,()=>{});
  // 2. Перенести несделанные на завтра
  for (const id of p.moved) {
    const з = задачи.find(t=>String(t.id)===String(id));
    await supa.from('tasks').update({ due_date:завтра, defer_count:(з?.defer_count||0)+1 }).eq('id', id).then(r=>r,()=>{});
  }
  // 3. Сделанное вне списка → сразу как выполненные задачи (попадут в статистику/XP)
  if (p.new_done.length)
    await supa.from('tasks').insert(p.new_done.map(t=>({
      owner:'george', text:t, quadrant:'do', cat:'Работа', done:true,
      completed_at:сейчасISO, due_date:сегодня, xp_value:50,
    }))).then(r=>r,()=>{});
  // 4. Еда → meals (рингам КБЖУ на дашборде)
  if (p.meals.length)
    await supa.from('meals').insert(p.meals.map(m=>({
      owner:'george', date:сегодня, time_label:времяМСК, meal_type:m.meal_type||'snack',
      name:m.name||'Еда', items:[], calories:m.calories||0, protein:m.protein||0,
      fat:m.fat||0, carbs:m.carbs||0, note:'из вечернего рассказа',
    }))).then(r=>r,()=>{});
  // 5. Вода → KV nutrition (read-modify-write, newest-wins подхватит на клиентах).
  // Дата в формате toDateString() — как на фронте (иначе max-merge воды не засчитает день).
  if (p.water_ml > 0) {
    const деньStr = new Date(Date.now()+MSK).toDateString();
    const { data: kv } = await supa.from('kv').select('data').eq('owner','george').eq('key','nutrition').maybeSingle().then(r=>r,()=>({data:null}));
    const n = kv?.data || { water:0, waterGoal:2.5, date:деньStr };
    n.water = Math.round(((n.date===деньStr ? n.water||0 : 0) + p.water_ml/1000) * 100) / 100;
    n.date = деньStr;
    await supa.from('kv').upsert({ owner:'george', key:'nutrition', data:n, updated_at:сейчасISO }, { onConflict:'owner,key' }).then(r=>r,()=>{});
  }
  // 6. Идеи → банк идей
  if (p.ideas.length)
    await supa.from('idea_bank').insert(p.ideas.map(t=>({ owner:'george', text:t, cat:'из дня' }))).then(r=>r,()=>{});
  // 7. Исторический снимок дня
  await supa.from('day_log').upsert({
    owner:'george', date:сегодня, report:текст, summary:p.note,
    done_count:p.done.length, moved_count:p.moved.length, new_count:p.new_done.length,
    meals_count:p.meals.length, water_added_ml:p.water_ml, ideas_count:p.ideas.length,
  }, { onConflict:'owner,date' }).then(r=>r,()=>{});

  const строки = [
    `🌙 *Разбор дня*`,
    `✅ Закрыл: ${p.done.length}` + (p.new_done.length ? ` (+${p.new_done.length} вне списка)` : ''),
    p.moved.length ? `⏭ Перенёс на завтра: ${p.moved.length}` : '',
    p.meals.length ? `🍽 Приёмов еды: ${p.meals.length}` : '',
    p.water_ml ? `💧 Вода: +${p.water_ml} мл` : '',
    p.ideas.length ? `💡 Идей в банк: ${p.ideas.length}` : '',
    p.note ? `\n_${p.note}_` : '',
  ].filter(Boolean).join('\n');
  const клав = new InlineKeyboard().webApp('📊 Открыть дашборд', безКэша());
  await bot.api.sendMessage(ownerTgId, строки, { parse_mode:'Markdown', reply_markup:клав }).catch(()=>{});

  // Сразу собираем план на завтра (контекст учтёт обновлённые задачи)
  await отправитьПлан({ bot, supa, openai, ownerTgId, безКэша }, текст,
    { дата: завтра, заголовок: 'План на завтра' });
}

// ── Утро: спросить план (ответ/кнопка → генерация) ───────────────────────────
export async function утреннийКоуч({ bot, ownerTgId, безКэша, ждёмПлан }) {
  ждёмПлан?.set(String(ownerTgId), true); // следующий текст/голос → план
  const клав = new InlineKeyboard()
    .text('🗓 Составь план сам', 'coach:gen').row()
    .text('🎙 Расскажу голосом', 'coach:voice');
  await bot.api.sendMessage(ownerTgId,
    `☀️ *Доброе утро, Джордж!*\nКакой план на сегодня помимо текущего списка? Накидай голосом/текстом — соберу плотный распорядок по часам с фокусом на деньги.\n\nИли жми «Составь план сам».`,
    { parse_mode: 'Markdown', reply_markup: клав }
  ).catch(e => console.warn('[coach morning]', e.message));
}
