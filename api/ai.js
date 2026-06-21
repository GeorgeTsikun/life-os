// ── /api/ai — единая функция-роутер для AI-endpoint'ов ───────────────────────
// Объединяет несколько эндпоинтов в одну serverless-функцию (лимит Vercel Hobby
// = 12 функций). Старые пути сохранены через rewrites в vercel.json:
//   /api/task-draft → /api/ai?op=task-draft  и т.д.
import taskDraft from './_lib/task-draft.js';
import decomposeProject from './_lib/decompose-project.js';
import healthSummary from './_lib/health-summary.js';
import classifyTask from './_lib/classify-task.js';
import extractOnboarding from './_lib/extract-onboarding.js';

export const config = { maxDuration: 30 };

const OPS = {
  'task-draft': taskDraft,
  'decompose-project': decomposeProject,
  'health-summary': healthSummary,
  'classify-task': classifyTask,
  'extract-onboarding': extractOnboarding,
};

export default async function handler(req, res) {
  const op = req.query?.op;
  const fn = OPS[op];
  if (!fn) return res.status(404).json({ error: `unknown op: ${op}` });
  return fn(req, res);
}
