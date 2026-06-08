// ── Supabase Edge Function: синхронизация Apple Health ────────────────────────
// Вызывается из iOS Shortcut каждое утро в 07:00
// Принимает данные о здоровье и сохраняет в таблицу health_metrics

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const СЕКРЕТ = Deno.env.get('HEALTH_SYNC_SECRET') ?? ''

serve(async (req: Request) => {
  // Проверка метода
  if (req.method !== 'POST') {
    return new Response('Только POST', { status: 405 })
  }

  // Проверка секрета
  const заголовок = req.headers.get('x-health-secret')
  if (заголовок !== СЕКРЕТ) {
    return new Response('Неверный секрет', { status: 401 })
  }

  let данные: Record<string, unknown>
  try {
    данные = await req.json()
  } catch {
    return new Response('Неверный JSON', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Ищем пользователя по user_id из параметра
  const userId = данные.user_id as string
  if (!userId) {
    return new Response('Нет user_id', { status: 400 })
  }

  // Upsert данных здоровья за сегодня
  const сегодня = new Date().toISOString().split('T')[0]
  const { error } = await supabase
    .from('health_metrics')
    .upsert({
      user_id:          userId,
      date:             сегодня,
      sleep_h:          данные.sleep_h,
      sleep_quality_pct: данные.sleep_quality,
      deep_pct:         данные.deep_pct,
      rem_pct:          данные.rem_pct,
      hrv_ms:           данные.hrv,
      resting_hr:       данные.resting_hr,
      steps:            данные.steps,
      calories_burned:  данные.calories,
      km:               данные.km,
      move_pct:         данные.move,
      exercise_pct:     данные.exercise,
      stand_pct:        данные.stand,
    }, { onConflict: 'user_id,date' })

  if (error) {
    return new Response(`Ошибка БД: ${error.message}`, { status: 500 })
  }

  return new Response(
    JSON.stringify({ ok: true, дата: сегодня }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
