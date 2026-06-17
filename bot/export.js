// ── LIFE OS — Односторонний экспорт в Markdown (зеркало для Obsidian) ─────────
// /export собирает снимок базы в один .md и шлёт документом. Перезапустить →
// свежий снимок. ponytail: одноразовый снимок, не непрерывный синк (для синка
// нужен локальный агент в волте — отдельная задача, если понадобится).
import { InputFile } from 'grammy';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '';

export async function экспортВMarkdown({ bot, supa, ownerTgId }) {
  await bot.api.sendChatAction(ownerTgId, 'upload_document').catch(()=>{});
  const sel = (t, cols, order='created_at.desc', lim=200) =>
    supa.from(t).select(cols).eq('owner','george').order(order.split('.')[0], { ascending: order.endsWith('asc') }).limit(lim).then(r=>r.data||[], ()=>[]);

  const [goalsKv, projects, tasks, people, meetings, days, ideas, expects] = await Promise.all([
    supa.from('kv').select('data').eq('owner','george').eq('key','lifegoals').maybeSingle().then(r=>r.data?.data||[],()=>[]),
    sel('projects','name,stage,progress,current,target'),
    sel('tasks','text,quadrant,cat,done,due_date'),
    sel('people','name,rel,commitment,notes'),
    sel('meeting_notes','title,date,summary,decisions,commitments,risks','date.desc',100),
    sel('day_log','date,summary,report','date.desc',120),
    sel('idea_bank','text,cat'),
    sel('expectations','owner_name,what,deadline,status'),
  ]);

  const L = [];
  L.push(`# LIFE OS — снимок\n_Сгенерировано ${new Date().toLocaleString('ru-RU')}_\n`);

  L.push(`\n## 🎯 Цели`);
  goalsKv.length ? goalsKv.forEach(g=>L.push(`- **${g.title}** — ${g.current}/${g.target} ${g.unit||''}${g.deadline?` (до ${g.deadline})`:''}`)) : L.push('_нет_');

  L.push(`\n## 🚀 Проекты`);
  projects.length ? projects.forEach(p=>L.push(`- **${p.name}** — ${p.stage||'—'}, ${p.progress||0}%`)) : L.push('_нет_');

  L.push(`\n## 📋 Задачи (открытые)`);
  const open = tasks.filter(t=>!t.done);
  open.length ? open.forEach(t=>L.push(`- [ ] ${t.text}${t.due_date?` 📅 ${t.due_date}`:''} _(${t.cat||t.quadrant})_`)) : L.push('_нет_');

  L.push(`\n## 👥 Люди`);
  people.length ? people.forEach(p=>L.push(`- **${p.name}**${p.rel?` (${p.rel})`:''}${p.commitment?` — ${p.commitment}`:''}${p.notes?`\n  - ${p.notes}`:''}`)) : L.push('_нет_');

  L.push(`\n## 👀 Жду от других`);
  expects.length ? expects.forEach(e=>L.push(`- ${e.what} ← **${e.owner_name||'?'}**${e.deadline?` (до ${e.deadline})`:''} [${e.status}]`)) : L.push('_нет_');

  L.push(`\n## 📝 Созвоны`);
  meetings.length ? meetings.forEach(m=>{
    L.push(`\n### ${m.title||'Созвон'} — ${fmtDate(m.date)}`);
    if (m.summary) L.push(m.summary);
    const arr=(a)=>Array.isArray(a)?a:[];
    if (arr(m.decisions).length) L.push(`**Решения:** ${arr(m.decisions).join('; ')}`);
    if (arr(m.commitments).length) L.push(`**Обязательства:** ${arr(m.commitments).map(c=>`${c.who||'?'}: ${c.what}${c.due?` (${c.due})`:''}`).join('; ')}`);
    if (arr(m.risks).length) L.push(`**Риски:** ${arr(m.risks).join('; ')}`);
  }) : L.push('_нет_');

  L.push(`\n## 💡 Идеи`);
  ideas.length ? ideas.forEach(i=>L.push(`- ${i.text}${i.cat?` _(${i.cat})_`:''}`)) : L.push('_нет_');

  L.push(`\n## 📅 Дневник`);
  days.length ? days.forEach(d=>L.push(`\n### ${fmtDate(d.date)}\n${d.summary||''}${d.report?`\n> ${d.report}`:''}`)) : L.push('_нет_');

  const md = L.join('\n');
  const файл = new InputFile(Buffer.from(md, 'utf-8'), `LIFE_OS_${new Date().toISOString().slice(0,10)}.md`);
  await bot.api.sendDocument(ownerTgId, файл, {
    caption: '🗂 Снимок базы в Markdown — закинь в свой Obsidian-волт. Перезапусти /export для свежего.',
  }).catch(e=>{ console.warn('[export]', e.message); bot.api.sendMessage(ownerTgId, `⚠️ Экспорт не удался: ${e.message}`); });
}
