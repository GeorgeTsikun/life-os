// ── LIFE OS — рантайм-выбор модели ИИ (без env/деплоя) ───────────────────────
// Источник истины: Supabase config.life_model. Фолбэк: process.env.LIFE_MODEL → дефолт.
// getActiveModel() синхронна (отдаёт кэш); фоновой refresh раз в 60с тянет из БД.

const DEFAULT_MODEL = 'gpt-5.5';
let _model     = process.env.LIFE_MODEL || DEFAULT_MODEL;
let _supa      = null;
let _lastFetch = 0;

export function initModel(supa) { _supa = supa; refresh(); }

export function getActiveModel() {
  if (_supa && Date.now() - _lastFetch > 60000) refresh(); // лениво обновляем кэш
  return _model;
}

async function refresh() {
  _lastFetch = Date.now();
  if (!_supa) return;
  try {
    const { data } = await _supa.from('config').select('value').eq('key', 'life_model').maybeSingle();
    if (data?.value) _model = data.value;
  } catch (e) { console.warn('[model] refresh:', e.message); }
}

export async function setActiveModel(supa, id) {
  _model = id; _lastFetch = Date.now();
  if (!supa) return false;
  const { error } = await supa.from('config')
    .upsert({ key: 'life_model', value: id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) { console.error('[model] set:', error.message); return false; }
  return true;
}

// Устойчивый парсинг JSON-ответа модели: чистит ```-ограждения, выдёргивает
// {...}; кидает понятную ошибку при пустом контенте (reasoning съел токены).
export function парсJSONОтвет(r) {
  let s = (r?.choices?.[0]?.message?.content || '').trim();
  if (!s) throw new Error('пустой ответ модели (увеличь max_completion_tokens или смени модель)');
  s = s.replace(/```json\s*|\s*```/g, '').trim();
  try { return JSON.parse(s); }
  catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('не удалось разобрать JSON ответа модели');
  }
}

// Список доступных моделей из OpenAI (только чат-модели gpt/o)
export async function listOpenAIModels() {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return (data.data || [])
      .map(m => m.id)
      .filter(id => /^(gpt|o\d|chatgpt)/.test(id))
      .sort();
  } catch (e) { console.warn('[model] list:', e.message); return []; }
}
