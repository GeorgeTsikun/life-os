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
      localStorage.setItem('lifeos_tasks', JSON.stringify(tasks.map(маппингЗадачи)));
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
