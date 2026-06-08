// ── СИНХРОНИЗАЦИЯ Mini App ↔ Supabase ────────────────────────────────────────
// Логика:
//   1. На старте: pull из Supabase → если есть данные, перетираем localStorage
//   2. После каждой записи: push в Supabase (fire-and-forget)
//   3. Без блокировки UI — Mini App работает на localStorage, Supabase = облако

let клиент = null;
let владелец = 'george';
let готов = false;

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────────────────────────
export async function инициализироватьSupabase() {
  try {
    const ответ = await fetch('/api/config');
    const конфиг = await ответ.json();
    if (!конфиг.supabaseUrl || !конфиг.supabaseAnonKey) {
      console.log('[Supabase] не настроен — работаем на localStorage');
      return false;
    }
    владелец = конфиг.owner || 'george';

    // Динамический импорт supabase-js из CDN
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
    клиент = createClient(конфиг.supabaseUrl, конфиг.supabaseAnonKey);
    готов = true;
    console.log('[Supabase] подключён');
    return true;
  } catch (err) {
    console.warn('[Supabase] ошибка инициализации:', err);
    return false;
  }
}

export function активен() { return готов && клиент !== null; }

// ── PULL: загружаем всё из облака в localStorage ─────────────────────────────
export async function загрузитьВсё() {
  if (!активен()) return false;
  try {
    const [tasks, projects, people, profile, dailyLog, quests, achievements] = await Promise.all([
      клиент.from('tasks').select('*').eq('owner', владелец).order('created_at'),
      клиент.from('projects').select('*').eq('owner', владелец),
      клиент.from('people').select('*').eq('owner', владелец),
      клиент.from('profile').select('*').eq('owner', владелец).single(),
      клиент.from('daily_log').select('*').eq('owner', владелец).eq('date', new Date().toISOString().split('T')[0]).maybeSingle(),
      клиент.from('quests').select('*').eq('owner', владелец).eq('date', new Date().toISOString().split('T')[0]),
      клиент.from('achievements').select('*').eq('owner', владелец),
    ]);

    // Маппинг snake_case → camelCase
    if (tasks.data?.length) {
      localStorage.setItem('lifeos_tasks', JSON.stringify(tasks.data.map(маппингЗадачи)));
    }
    if (projects.data?.length) {
      localStorage.setItem('lifeos_projects', JSON.stringify(projects.data.map(маппингПроекта)));
    }
    if (people.data?.length) {
      localStorage.setItem('lifeos_people', JSON.stringify(people.data.map(маппингЧеловека)));
    }
    if (profile.data) {
      localStorage.setItem('lifeos_profile', JSON.stringify({
        name:       profile.data.name,
        tagline:    profile.data.tagline,
        avatar:     profile.data.avatar,
        xp:         profile.data.xp,
        level:      profile.data.level,
        streak:     profile.data.streak,
        lastActive: profile.data.last_active,
      }));
      if (profile.data.rpg_stats) {
        localStorage.setItem('lifeos_rpgStats', JSON.stringify(profile.data.rpg_stats));
      }
    }
    if (dailyLog.data) {
      localStorage.setItem('lifeos_dailyLog', JSON.stringify({
        energy: dailyLog.data.energy_level,
        mood:   dailyLog.data.mood,
        focus:  dailyLog.data.focus_h,
        note:   dailyLog.data.note,
      }));
    }
    if (quests.data?.length) {
      localStorage.setItem('lifeos_quests', JSON.stringify(quests.data.map(q => ({
        id: q.id, title: q.title, icon: q.icon, xp: q.xp_reward, done: q.completed
      }))));
    }
    if (achievements.data?.length) {
      const локальные = JSON.parse(localStorage.getItem('lifeos_achievements') || '[]');
      const разблокированные = new Set(achievements.data.map(a => a.achievement_key));
      локальные.forEach(a => {
        if (разблокированные.has(a.key)) a.unlocked = true;
      });
      localStorage.setItem('lifeos_achievements', JSON.stringify(локальные));
    }
    return true;
  } catch (err) {
    console.warn('[Supabase] не удалось загрузить:', err);
    return false;
  }
}

// ── PUSH: отправляем изменения в облако ──────────────────────────────────────
export async function сохранитьЗадачу(задача) {
  if (!активен()) return;
  try {
    await клиент.from('tasks').upsert({
      id:          задача.id?.startsWith('t') ? undefined : задача.id, // UUID только
      owner:       владелец,
      text:        задача.text,
      quadrant:    задача.quadrant,
      cat:         задача.cat,
      time_label:  задача.time,
      done:        задача.done,
      xp_value:    задача.xpValue,
    }, { onConflict: 'id' });
  } catch (err) { console.warn('[Supabase] task save:', err); }
}

export async function сохранитьПроект(проект) {
  if (!активен()) return;
  try {
    await клиент.from('projects').upsert({
      id:           проект.id?.startsWith('p') ? undefined : проект.id,
      owner:        владелец,
      name:         проект.name,
      emoji:        проект.emoji,
      target:       проект.target,
      current:      проект.current,
      progress:     проект.progress,
      color:        проект.color,
      stage:        проект.stage,
      tasks_count:  проект.tasksCount,
    }, { onConflict: 'id' });
  } catch (err) { console.warn('[Supabase] project save:', err); }
}

export async function сохранитьПрофиль(профиль) {
  if (!активен()) return;
  try {
    await клиент.from('profile').upsert({
      owner:       владелец,
      name:        профиль.name,
      tagline:     профиль.tagline,
      avatar:      профиль.avatar,
      xp:          профиль.xp,
      level:       профиль.level,
      streak:      профиль.streak,
      last_active: профиль.lastActive,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'owner' });
  } catch (err) { console.warn('[Supabase] profile save:', err); }
}

export async function сохранитьДневник(д) {
  if (!активен()) return;
  try {
    await клиент.from('daily_log').upsert({
      owner: владелец,
      date:  new Date().toISOString().split('T')[0],
      energy_level: д.energy,
      mood: д.mood,
      focus_h: д.focus,
      note: д.note,
    }, { onConflict: 'owner,date' });
  } catch (err) { console.warn('[Supabase] daily_log:', err); }
}

export async function сохранитьЗдоровье(h) {
  if (!активен()) return;
  try {
    await клиент.from('health_metrics').upsert({
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
    }, { onConflict: 'owner,date' });
  } catch (err) { console.warn('[Supabase] health:', err); }
}

export async function разблокироватьДостижение(key) {
  if (!активен()) return;
  try {
    await клиент.from('achievements').upsert({
      owner: владелец,
      achievement_key: key,
    }, { onConflict: 'owner,achievement_key' });
  } catch (err) { console.warn('[Supabase] ach:', err); }
}

// ── МАППИНГ КОЛОНОК БД → СВОЙСТВА UI ─────────────────────────────────────────
function маппингЗадачи(t) {
  return {
    id: t.id, text: t.text, cat: t.cat, time: t.time_label,
    quadrant: t.quadrant, done: t.done, xpValue: t.xp_value,
    createdAt: new Date(t.created_at).getTime(),
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
