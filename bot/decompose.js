// ── LIFE OS — Декомпозиция задач через GPT ───────────────────────────────────
import { getActiveModel } from './model.js';
// «Разбей задачу X» → GPT предлагает 3-7 шагов → кнопки ✅/✏️/❌ →
// при подтверждении пишем в tasks.subtasks (jsonb), видно в Mini App.
//
// Зарегистрировать обработчики в index.js через зарегистрироватьДекомпозицию({...}).

import { InlineKeyboard } from 'grammy';

// Временное хранилище предложений: token → { taskId|null, text, subtasks, chatId }
const ПРЕДЛОЖЕНИЯ = new Map();
// Кто сейчас правит декомпозицию: userId → token (ждём текст с правками)
const ЖДЁМ_ПРАВКИ = new Map();

let _кор = 0;
function новыйТокен() {
  _кор = (_кор + 1) % 1e6;
  return Date.now().toString(36) + _кор.toString(36);
}

const DECOMP_PROMPT =
  `Ты — ассистент по декомпозиции задач. Разбей цель на 3-7 конкретных, ` +
  `выполнимых шагов на русском. Каждый шаг — короткое действие (глагол + объект), ` +
  `по порядку выполнения. Без воды, без вступлений. ` +
  `Верни JSON: {"subtasks":[{"text":"..."}], "note":"опционально 1 фраза"}.`;

// ── Запрос к GPT ──────────────────────────────────────────────────────────────
async function сгенерировать(openai, цель, правки = '') {
  const messages = [
    { role: 'system', content: DECOMP_PROMPT },
    { role: 'user', content: `Задача: ${цель}` },
  ];
  if (правки) messages.push({ role: 'user', content: `Учти правки: ${правки}` });

  const r = await openai.chat.completions.create({
    model: getActiveModel(),
    response_format: { type: 'json_object' },
    messages,
  });
  const parsed = JSON.parse(r.choices[0].message.content);
  const subtasks = (Array.isArray(parsed.subtasks) ? parsed.subtasks : [])
    .map(s => (typeof s === 'string' ? { text: s } : s))
    .filter(s => s && s.text)
    .map(s => ({ text: String(s.text).trim() }));
  return { subtasks, note: parsed.note || '' };
}

// ── Превью с кнопками ────────────────────────────────────────────────────────
function превьюТекст(цель, subtasks, note) {
  const шаги = subtasks.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
  return `🧩 *Декомпозиция:* ${цель}\n\n${шаги}` + (note ? `\n\n_${note}_` : '') +
    `\n\nСохранить эти шаги как подзадачи?`;
}

async function показатьПревью(ctx, token) {
  const предл = ПРЕДЛОЖЕНИЯ.get(token);
  if (!предл) return;
  const клав = new InlineKeyboard()
    .text('✅ Сохранить', `dec:save:${token}`)
    .text('✏️ Изменить', `dec:edit:${token}`)
    .text('❌ Отмена', `dec:cancel:${token}`);
  await ctx.reply(превьюТекст(предл.text, предл.subtasks, предл.note),
    { parse_mode: 'Markdown', reply_markup: клав });
}

// ── Точка входа: декомпозировать цель (из команды/текста/кнопки) ──────────────
// arg может быть текстом цели ИЛИ {taskId, text} если задача уже в Supabase.
export async function начатьДекомпозицию(ctx, { openai, supa }, arg) {
  let taskId = null;
  let цель = '';

  if (typeof arg === 'object' && arg) {
    taskId = arg.taskId || null;
    цель = arg.text || '';
  } else {
    цель = String(arg || '').trim();
  }

  if (!цель) {
    return ctx.reply('Что разбить? Напиши: `/decompose Запустить лендинг VAIB`', { parse_mode: 'Markdown' });
  }

  await ctx.replyWithChatAction('typing');
  let результат;
  try {
    результат = await сгенерировать(openai, цель);
  } catch (err) {
    console.error('[decompose] GPT:', err.message);
    return ctx.reply(`⚠️ Не смог разбить: ${err.message}`);
  }
  if (!результат.subtasks.length) {
    return ctx.reply('🤷 Не получилось выделить шаги. Сформулируй задачу конкретнее.');
  }

  const token = новыйТокен();
  ПРЕДЛОЖЕНИЯ.set(token, { taskId, text: цель, subtasks: результат.subtasks, note: результат.note, chatId: ctx.chat.id });
  await показатьПревью(ctx, token);
}

// ── Сохранение в Supabase ─────────────────────────────────────────────────────
async function сохранить(предл, supa) {
  const subtasks = предл.subtasks.map(s => ({ text: s.text, done: false }));

  // Задача уже существует — мержим с имеющимися подзадачами
  if (предл.taskId) {
    const { data } = await supa.from('tasks').select('subtasks').eq('id', предл.taskId).maybeSingle();
    const прежние = Array.isArray(data?.subtasks) ? data.subtasks : [];
    const { error } = await supa.from('tasks')
      .update({ subtasks: [...прежние, ...subtasks] })
      .eq('id', предл.taskId);
    if (error) throw new Error(error.message);
    return предл.taskId;
  }

  // Новая задача из текста
  const { data, error } = await supa.from('tasks').insert({
    owner: 'george',
    text: предл.text,
    quadrant: 'schedule',
    xp_value: 50,
    subtasks,
  }).select();
  if (error) throw new Error(error.message);
  return data?.[0]?.id;
}

// ── Регистрация callback-обработчиков dec:* ──────────────────────────────────
export function зарегистрироватьДекомпозицию({ bot, supa, openai }) {
  bot.callbackQuery(/^dec:(save|edit|cancel):(.+)$/, async (ctx) => {
    const action = ctx.match[1];
    const token = ctx.match[2];
    const предл = ПРЕДЛОЖЕНИЯ.get(token);
    await ctx.answerCallbackQuery();

    if (!предл) {
      return ctx.reply('⌛ Это предложение устарело. Запусти декомпозицию заново.');
    }

    if (action === 'cancel') {
      ПРЕДЛОЖЕНИЯ.delete(token);
      return ctx.editMessageText('❌ Декомпозиция отменена.');
    }

    if (action === 'edit') {
      ЖДЁМ_ПРАВКИ.set(ctx.from.id, token);
      return ctx.reply('✏️ Напиши голосом или текстом, что поправить в шагах (добавить/убрать/детализировать).');
    }

    if (action === 'save') {
      if (!supa) return ctx.reply('⚠️ Supabase не подключён — некуда сохранять.');
      try {
        await сохранить(предл, supa);
        ПРЕДЛОЖЕНИЯ.delete(token);
        const шаги = предл.subtasks.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
        await ctx.editMessageText(
          `✅ *Сохранено ${предл.subtasks.length} подзадач* — видно в Mini App\n\n${шаги}`,
          { parse_mode: 'Markdown' });
      } catch (err) {
        console.error('[decompose] save:', err.message);
        await ctx.reply(`⚠️ Не удалось сохранить: ${err.message}`);
      }
    }
  });
}

// ── Перехват текста/голоса с правками (вызывать из index.js до классификации) ──
// Возвращает true если сообщение было правкой и обработано.
export async function перехватитьПравку(ctx, текст, { openai, supa }) {
  const token = ЖДЁМ_ПРАВКИ.get(ctx.from.id);
  if (!token) return false;
  const предл = ПРЕДЛОЖЕНИЯ.get(token);
  ЖДЁМ_ПРАВКИ.delete(ctx.from.id);
  if (!предл) {
    await ctx.reply('⌛ Предложение устарело. Запусти декомпозицию заново.');
    return true;
  }

  await ctx.replyWithChatAction('typing');
  try {
    const результат = await сгенерировать(openai, предл.text, текст);
    if (результат.subtasks.length) {
      предл.subtasks = результат.subtasks;
      предл.note = результат.note;
      ПРЕДЛОЖЕНИЯ.set(token, предл);
    }
  } catch (err) {
    console.warn('[decompose] edit gpt:', err.message);
  }
  await показатьПревью(ctx, token);
  return true;
}

// ── Ждём ли мы правку от этого пользователя ──────────────────────────────────
export function ждётПравку(userId) {
  return ЖДЁМ_ПРАВКИ.has(userId);
}
