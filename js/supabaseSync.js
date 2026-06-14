// ── СИНХРОНИЗАЦИЯ Mini App ↔ Supabase ────────────────────────────────────────
// Прямой REST API — без библиотеки supabase-js, чтобы избежать проблем
// с динамической загрузкой и новым форматом ключей sb_publishable_*

let базаURL = '';
let ключ = '';
let владелец = 'george';
let готов = false;

const заголовки = () => ({
  apikey: ключ,
  Authorization: `Bearer ${ключ}`,
  'Content-Type': 'application/json',
});

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────
export async function инициализироватьSupabase() {
  try {
    const ответ = await fetch('/api/config');
    const конфиг = await ответ.json();
    if (!конфиг.supabaseUrl || !конфиг.supabaseAnonKey) {
      console.log('[Supabase] env не настроен — работаем на localStorage');
      return false;
    }
    базаURL = конфиг.supabaseUrl.replace(/\/$/, '') + '/rest/v1';
    ключ = конфиг.supabaseAnonKey;
    владелец = конфиг.owner || 'george';

    // Тест соединения
    const тест = await fetch(`${базаURL}/profile?owner=eq.${владелец}&select=owner`, { headers: заголовки() });
    if (!тест.ok) {
      console.warn('[Supabase] тест соединения упал:', тест.status, await тест.text());
      return false;
    }

    готов = true;
    console.log('[Supabase] подключён через REST API');
    return true;
  } catch (err) {
    console.warn('[Supabase] ошибка инициализации:', err);
    return false;
  }
}

export function активен() { return готов; }

// ── REST-ХЕЛПЕРЫ ──────────────────────────────────────────────────────────────
async function запросSelect(таблица, params = '') {
  const url = `${базаURL}/${таблица}?owner=eq.${владелец}&select=*${params ? '&' + params : ''}`;
  const res = await fetch(url, { headers: заголовки() });
  if (!res.ok) {
    console.warn(`[Supabase ${таблица} GET]`, res.status, await res.text());
    return [];
  }
  return res.json();
}

async function запросUpsert(таблица, тело, conflictKey = 'id') {
  const url = `${базаURL}/${таблица}?on_conflict=${conflictKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...заголовки(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(Array.isArray(тело) ? тело : [тело]),
  });
  if (!res.ok) console.warn(`[Supabase ${таблица} UPSERT]`, res.status, await res.text());
  return res.ok;
}

// ── PULL: загружаем всё из облака в localStorage ─────────────────────────────
export async function загрузитьВсё() {
  if (!активен()) return false;
  try {
    const сегодня = new Date().toISOString().split('T')[0];
    const [tasks, projects, people, profileАрр, dailyАрр, quests, achievements, contentItems] = await Promise.all([
      запросSelect('tasks', 'order=created_at.asc'),
      запросSelect('projects'),
      запросSelect('people'),
      запросSelect('profile'),
      запросSelect('daily_log', `date=eq.${сегодня}`),
      запросSelect('quests', `date=eq.${сегодня}`),
      запросSelect('achievements'),
      запросSelect('content_items', 'order=created_at.desc').catch(() => []),
    ]);

    if (tasks?.length) {
      // ── УМНЫЙ MERGE: не затираем локальные изменения ──────────────────────────
      // Проблема: toggleTask() пушит в Supabase асинхронно (fire-and-forget).
      // Если pull пришёл раньше чем push долетел → Supabase вернёт done=false
      // и затрёт только что выполненную задачу.
      //
      // Решение: для каждой задачи из Supabase сравниваем с локальной версией.
      // Если локально done=true, а с сервера done=false → берём локальную версию
      // и сразу принудительно перепушиваем её в Supabase.
      const localRaw = JSON.parse(localStorage.getItem('lifeos_tasks') || '[]');
      const localMap = new Map(localRaw.map(t => [t.id, t]));

      // Дедупликация: если несколько строк с одним текстом — берём ту, где done=true
      const deduped = new Map();
      for (const t of tasks) {
        const key = t.id;
        if (!deduped.has(key)) {
          deduped.set(key, t);
        } else {
          // Предпочитаем выполненную версию
          if (t.done) deduped.set(key, t);
        }
      }

      const merged = Array.from(deduped.values()).map(serverTask => {
        const mapped  = маппингЗадачи(serverTask);
        const local   = localMap.get(mapped.id);
        if (!local) return mapped;

        // Если локально задача выполнена/отменена, а с сервера нет → доверяем локалу
        if ((local.done && !mapped.done) || (local.cancelled && !mapped.cancelled)) {
          // Перепушиваем в фоне чтобы синхронизировать Supabase
          setTimeout(() => сохранитьЗадачу(local), 0);
          return local;
        }
        return mapped;
      });

      // ── СОХРАНЯЕМ ЛОКАЛЬНЫЕ задачи, которых ещё нет в облаке ──────────────────
      // (созданы офлайн / до синка / без валидного UUID). Иначе pull их затирал —
      // приложение и бот расходились. Заливку в облако делает pushAllLocal().
      const serverIds = new Set(deduped.keys());
      for (const local of localRaw) {
        if (!serverIds.has(local.id)) merged.push(local);
      }

      localStorage.setItem('lifeos_tasks', JSON.stringify(merged));
    }
    if (projects?.length) {
      localStorage.setItem('lifeos_projects', JSON.stringify(projects.map(маппингПроекта)));
    }
    if (people?.length) {
      localStorage.setItem('lifeos_people', JSON.stringify(people.map(маппингЧеловека)));
    }
    const профиль = profileАрр?.[0];
    if (профиль) {
      localStorage.setItem('lifeos_profile', JSON.stringify({
        name:       профиль.name,
        tagline:    профиль.tagline,
        avatar:     профиль.avatar,
        xp:         профиль.xp,
        level:      профиль.level,
        streak:     профиль.streak,
        lastActive: профиль.last_active,
      }));
      if (профиль.rpg_stats) {
        localStorage.setItem('lifeos_rpgStats', JSON.stringify(профиль.rpg_stats));
      }
    }
    const dailyЗап = dailyАрр?.[0];
    if (dailyЗап) {
      localStorage.setItem('lifeos_dailyLog', JSON.stringify({
        energy: dailyЗап.energy_level,
        mood:   dailyЗап.mood,
        focus:  dailyЗап.focus_h,
        note:   dailyЗап.note,
      }));
    }
    if (quests?.length) {
      localStorage.setItem('lifeos_quests', JSON.stringify(quests.map(q => ({
        id: q.id, title: q.title, icon: q.icon, xp: q.xp_reward, done: q.completed
      }))));
    }
    if (achievements?.length) {
      const локальные = JSON.parse(localStorage.getItem('lifeos_achievements') || '[]');
      const разблокированные = new Set(achievements.map(a => a.achievement_key));
      локальные.forEach(a => { if (разблокированные.has(a.key)) a.unlocked = true; });
      localStorage.setItem('lifeos_achievements', JSON.stringify(локальные));
    }
    if (contentItems?.length) {
      localStorage.setItem('lifeos_content', JSON.stringify(contentItems.map(маппингКонтента)));
    }

    // Приёмы пищи за сегодня (фото еды от бота появляются в приложении)
    try {
      const mealsData = await запросSelect('meals', `date=eq.${сегодня}&order=time_label.asc`).catch(() => []);
      if (Array.isArray(mealsData)) {
        const mealsKey = 'lifeos_meals_' + сегодня;
        const локальные = JSON.parse(localStorage.getItem(mealsKey) || '[]');
        const serverIds = new Set(mealsData.map(m => m.id));
        const merged = mealsData.map(m => ({
          id: m.id, date: m.date, time: m.time_label, mealType: m.meal_type,
          name: m.name, items: m.items || [], calories: m.calories, protein: m.protein,
          fat: m.fat, carbs: m.carbs, weight_g: m.weight_g, health_score: m.health_score,
          photo: m.photo, note: m.note,
        }));
        // локальные, которых ещё нет в облаке — оставляем (зальются хуком)
        for (const local of локальные) if (!serverIds.has(local.id)) merged.push(local);
        localStorage.setItem(mealsKey, JSON.stringify(merged));
        // пересчёт суммарных КБЖУ
        const n = JSON.parse(localStorage.getItem('lifeos_nutrition') || '{}');
        n.calories = merged.reduce((s,m)=>s+(m.calories||0),0);
        n.protein  = merged.reduce((s,m)=>s+(m.protein||0),0);
        n.fat      = merged.reduce((s,m)=>s+(m.fat||0),0);
        n.carbs    = merged.reduce((s,m)=>s+(m.carbs||0),0);
        localStorage.setItem('lifeos_nutrition', JSON.stringify(n));
      }
    } catch (e) { console.warn('[Supabase meals pull]', e.message); }

    // Финансовый модуль (один JSON-документ)
    try {
      const finRows = await запросSelect('finance').catch(() => []);
      if (finRows?.[0]?.data && Object.keys(finRows[0].data).length) {
        localStorage.setItem('lifeos_finance', JSON.stringify(finRows[0].data));
      }
    } catch (e) { console.warn('[Supabase finance pull]', e.message); }

    // Инбокс — последние 50 записей (голосовые из бота)
    try {
      const inboxData = await запросSelect('inbox', 'order=created_at.desc&limit=50');
      if (inboxData?.length) {
        localStorage.setItem('lifeos_inbox', JSON.stringify(inboxData.map(r => ({
          id:            r.id,
          source:        r.source,
          text:          r.raw_text,
          type:          r.classified_as,
          created_at:    r.created_at,
          task_id:       r.task_id || null,
        }))));
      }
    } catch {}

    // Ожидания + Банк идей
    await Promise.allSettled([загрузитьОжидания(), загрузитьИдеи()]);

    console.log(`[Supabase] подтянул: задач=${tasks?.length||0} проектов=${projects?.length||0} людей=${people?.length||0} контента=${contentItems?.length||0}`);
    return true;
  } catch (err) {
    console.warn('[Supabase] не удалось загрузить:', err);
    return false;
  }
}

// ── PUSH: отправляем изменения в облако ──────────────────────────────────────
export async function сохранитьЗадачу(задача) {
  if (!активен()) return;
  // Без UUID не пушим — иначе Supabase создаст дубль, и при следующем pull
  // старая запись с done=false "вернёт" уже выполненную задачу обратно.
  if (!uuidValid(задача.id)) {
    console.warn('[Supabase] task без UUID — skip push:', задача.id, задача.text);
    return;
  }
  await запросUpsert('tasks', {
    id: задача.id,
    owner:        владелец,
    text:         задача.text,
    quadrant:     задача.quadrant,
    cat:          задача.cat,
    time_label:   задача.time,
    done:         задача.done,
    xp_value:     задача.xpValue,
    due_date:     задача.due_date    || null,
    start_iso:    задача.start_iso   || null,
    completed_at: задача.completedAt || null,
    cancelled:    задача.cancelled   || false,
    cancelled_at: задача.cancelledAt || null,
    notes:        задача.notes       || null,
    subtasks:     задача.subtasks    || [],
    duration_min: задача.duration_min || 60,
    project_id:   задача.project_id  || null,
    person_id:    задача.person_id   || null,
  });
}

export async function удалитьЗадачу(id) {
  if (!активен()) return;
  if (!uuidValid(id)) return;
  try {
    await fetch(`${базаURL}/tasks?id=eq.${id}`, {
      method: 'DELETE',
      headers: заголовки(),
    });
  } catch (err) { console.warn('[Supabase delete task]', err); }
}

// ── PUSH ALL: заливаем ВСЕ локальные задачи в облако ─────────────────────────
// Чинит расхождение «в приложении есть, а бот не видит»: задачи без валидного
// UUID получают новый UUID, затем все задачи upsert-ятся в Supabase.
export async function pushAllLocal() {
  if (!активен()) return;
  let локальные;
  try { локальные = JSON.parse(localStorage.getItem('lifeos_tasks') || '[]'); }
  catch { return; }
  if (!Array.isArray(локальные) || !локальные.length) return;

  // 1. Мигрируем не-UUID id → валидный UUID (иначе сохранитьЗадачу их пропускает)
  let мигрировали = false;
  for (const t of локальные) {
    if (!uuidValid(t.id)) {
      t.id = (crypto?.randomUUID?.() || t.id);
      if (uuidValid(t.id)) мигрировали = true;
    }
  }
  if (мигрировали) localStorage.setItem('lifeos_tasks', JSON.stringify(локальные));

  // 2. Заливаем всё в облако (по очереди, чтобы не словить rate-limit)
  let залито = 0;
  for (const t of локальные) {
    if (uuidValid(t.id)) { await сохранитьЗадачу(t); залито++; }
  }
  console.log(`[Supabase] pushAllLocal: залито задач=${залито}`);
}

// ── ПРИЁМЫ ПИЩИ (Cal AI) ─────────────────────────────────────────────────────
export async function сохранитьПриёмПищи(meal) {
  if (!активен()) return;
  if (!uuidValid(meal.id)) return;
  await запросUpsert('meals', {
    id:       meal.id,
    owner:    владелец,
    date:     meal.date || new Date().toISOString().split('T')[0],
    time_label: meal.time || null,
    meal_type: meal.mealType || null,
    name:     meal.name || (Array.isArray(meal.items) ? meal.items.join(', ') : null),
    items:    meal.items || [],
    calories: meal.calories || 0,
    protein:  meal.protein  || 0,
    fat:      meal.fat      || 0,
    carbs:    meal.carbs    || 0,
    weight_g: meal.weight_g || null,
    health_score: meal.health_score || null,
    photo:    meal.photo || null,
    note:     meal.note  || null,
  });
}

export async function удалитьПриёмПищи(id) {
  if (!активен() || !uuidValid(id)) return;
  try {
    await fetch(`${базаURL}/meals?id=eq.${id}`, { method: 'DELETE', headers: заголовки() });
  } catch (err) { console.warn('[Supabase delete meal]', err); }
}

// ── ФИНАНСЫ (один JSON-документ) ─────────────────────────────────────────────
export async function сохранитьФинансы(data) {
  if (!активен()) return;
  await запросUpsert('finance', { owner: владелец, data, updated_at: new Date().toISOString() }, 'owner');
}

export async function сохранитьПроект(проект) {
  if (!активен()) return;
  await запросUpsert('projects', {
    ...(uuidValid(проект.id) ? { id: проект.id } : {}),
    owner:        владелец,
    name:         проект.name,
    emoji:        проект.emoji,
    target:       проект.target,
    current:      проект.current,
    progress:     проект.progress,
    color:        проект.color,
    stage:        проект.stage,
    tasks_count:  проект.tasksCount,
  });
}

export async function сохранитьПрофиль(профиль) {
  if (!активен()) return;
  await запросUpsert('profile', {
    owner:       владелец,
    name:        профиль.name,
    tagline:     профиль.tagline,
    avatar:      профиль.avatar,
    xp:          профиль.xp,
    level:       профиль.level,
    streak:      профиль.streak,
    last_active: профиль.lastActive,
    updated_at:  new Date().toISOString(),
  }, 'owner');
}

export async function сохранитьДневник(д) {
  if (!активен()) return;
  await запросUpsert('daily_log', {
    owner: владелец,
    date:  new Date().toISOString().split('T')[0],
    energy_level: д.energy,
    mood: д.mood,
    focus_h: д.focus,
    note: д.note,
  }, 'owner,date');
}

export async function сохранитьЗдоровье(h) {
  if (!активен()) return;
  await запросUpsert('health_metrics', {
    owner: владелец,
    date:  new Date().toISOString().split('T')[0],
    sleep_h:           h.sleep?.hours,
    sleep_quality_pct: h.sleep?.quality,
    deep_pct:          h.sleep?.deep,
    rem_pct:           h.sleep?.rem,
    hrv_ms:            h.hrv,
    resting_hr:        h.restingHr,
    steps:             h.steps,
    calories_burned:   h.calories,
    km:                h.km,
    move_pct:          h.move,
    exercise_pct:      h.exercise,
    stand_pct:         h.stand,
  }, 'owner,date');
}

export async function разблокироватьДостижение(key) {
  if (!активен()) return;
  await запросUpsert('achievements', {
    owner: владелец,
    achievement_key: key,
  }, 'owner,achievement_key');
}

// ── Ожидания (CRM Expectations) ──────────────────────────────────────────────
export async function сохранитьОжидание(e) {
  if (!активен()) return;
  await запросUpsert('expectations', {
    ...(uuidValid(e.id) ? { id: e.id } : {}),
    owner:      владелец,
    owner_name: e.owner,
    what:       e.what,
    deadline:   e.deadline || null,
    context:    e.context  || null,
    trigger:    e.trigger  || null,
    status:     e.status   || 'pending',
    created_at: e.createdAt || new Date().toISOString(),
    closed_at:  e.closedAt || null,
  });
}

export async function загрузитьОжидания() {
  if (!активен()) return;
  try {
    const data = await запросSelect('expectations', `status=eq.pending&order=created_at.desc`);
    if (data?.length) {
      localStorage.setItem('lifeos_expectations', JSON.stringify(data.map(r => ({
        id:        r.id,
        owner:     r.owner_name,
        what:      r.what,
        deadline:  r.deadline  || null,
        context:   r.context   || null,
        trigger:   r.trigger   || null,
        status:    r.status    || 'pending',
        createdAt: r.created_at,
        closedAt:  r.closed_at || null,
      }))));
    }
  } catch {}
}

// ── Банк идей ─────────────────────────────────────────────────────────────────
export async function сохранитьИдею(idea) {
  if (!активен()) return;
  await запросUpsert('idea_bank', {
    ...(uuidValid(idea.id) ? { id: idea.id } : {}),
    owner:          владелец,
    text:           idea.text,
    cat:            idea.cat  || null,
    notes:          idea.notes || null,
    source_task_id: idea.sourceTaskId || null,
    created_at:     idea.createdAt || new Date().toISOString(),
  });
}

export async function удалитьИдею(id) {
  if (!активен()) return;
  try {
    const url = `${базаURL}/idea_bank?id=eq.${id}&owner=eq.${владелец}`;
    await fetch(url, { method: 'DELETE', headers: заголовки() });
  } catch {}
}

export async function загрузитьИдеи() {
  if (!активен()) return;
  try {
    const data = await запросSelect('idea_bank', `order=created_at.desc`);
    if (data?.length) {
      localStorage.setItem('lifeos_ideaBank', JSON.stringify(data.map(r => ({
        id:           r.id,
        text:         r.text,
        cat:          r.cat   || null,
        notes:        r.notes || null,
        sourceTaskId: r.source_task_id || null,
        createdAt:    r.created_at,
      }))));
    }
  } catch {}
}

export async function сохранитьКонтентЭлемент(c) {
  if (!активен()) return;
  await запросUpsert('content_items', {
    ...(uuidValid(c.id) ? { id: c.id } : {}),
    owner:        владелец,
    title:        c.title,
    text:         c.text,
    notes:        c.notes,
    platforms:    c.platforms || [],
    content_type: c.content_type,
    status:       c.status || 'idea',
    publish_date: c.publish_date,
    refs:         c.refs || [],
    hashtags:     c.hashtags || [],
    caption:      c.caption,
    updated_at:   new Date().toISOString(),
  });
}

// ── МАППИНГ snake_case → camelCase ───────────────────────────────────────────
function маппингЗадачи(t) {
  return {
    id: t.id, text: t.text, cat: t.cat, time: t.time_label,
    quadrant: t.quadrant, done: t.done, xpValue: t.xp_value,
    createdAt: new Date(t.created_at).getTime(),
    due_date:    t.due_date     || null,
    start_iso:   t.start_iso    || null,
    completedAt: t.completed_at || null,
    cancelled:   t.cancelled    || false,   // ← не затирать при синке
    cancelledAt: t.cancelled_at || null,
    notes:       t.notes        || '',
    subtasks:    t.subtasks     || [],
    duration_min: t.duration_min || 60,
    project_id:  t.project_id  || null,
    person_id:   t.person_id   || null,
    google_event_id:   t.google_event_id   || null,
    google_event_link: t.google_event_link || null,
  };
}

function маппингПроекта(p) {
  return {
    id: p.id, name: p.name, emoji: p.emoji,
    target: p.target, current: p.current, progress: p.progress,
    color: p.color, stage: p.stage, tasksCount: p.tasks_count,
  };
}

function маппингЧеловека(p) {
  return {
    id: p.id, name: p.name, rel: p.rel,
    commitment: p.commitment, mine: p.mine, due: p.due_label,
    urgency: p.urgency, border: p.border, avatar: p.avatar,
    last: p.last_contact, notes: p.notes, log: p.log,
  };
}

function маппингКонтента(c) {
  return {
    id: c.id, title: c.title, text: c.text, notes: c.notes,
    platforms: c.platforms || [], content_type: c.content_type,
    status: c.status || 'idea',
    publish_date: c.publish_date, scheduled_at: c.scheduled_at,
    refs: c.refs || [], hashtags: c.hashtags || [], caption: c.caption,
    created_at: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
  };
}

function uuidValid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
