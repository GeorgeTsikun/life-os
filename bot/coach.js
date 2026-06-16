// ── LIFE OS — AI-коуч дня (Chief of Staff) ───────────────────────────────────
// Знает контекст (проекты/задачи/финансы/здоровье) → утром спрашивает план →
// генерит ПЛОТНЫЙ распорядок по часам → создаёт задачи с временем → шлёт в чат.
import { InlineKeyboard } from 'grammy';
import { getActiveModel } from './model.js';

const MSK = 3 * 3600 * 1000;
const сегодняМСК = () => new Date(Date.now() + MSK).toISOString().split('T')[0];

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
  return `Сегодня ${сегодня} (Москва).
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
    temperature: 0.6,
    max_tokens: 900,
  });
  const data = JSON.parse(r.choices[0].message.content);
  data.blocks = Array.isArray(data.blocks) ? data.blocks : [];
  return data;
}

// ── Создание задач из блоков + отправка плана ────────────────────────────────
export async function отправитьПлан({ bot, supa, openai, ownerTgId, безКэша }, доп = '') {
  await bot.api.sendChatAction(ownerTgId, 'typing').catch(()=>{});
  let план;
  try { план = await сгенерироватьПлан(openai, supa, доп); }
  catch (e) { return bot.api.sendMessage(ownerTgId, `⚠️ Не смог составить план: ${e.message}`); }
  if (!план.blocks.length) return bot.api.sendMessage(ownerTgId, '🤷 Не получилось составить план. Скажи пару задач — и я соберу.');

  const сегодня = сегодняМСК();
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
    `🗓 *Твой план на сегодня* (${план.blocks.length} блоков)\n\n${строкиТекст}\n\n_${план.note || 'Погнали. Деньги — топ-1.'}_\n\n✅ Блоки добавлены в задачи — напомню по времени.`,
    { parse_mode: 'Markdown', reply_markup: клав }
  ).catch(e => console.warn('[coach send]', e.message));
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
