import {
  getDatabase,
  json,
  readJson,
  requireId,
  requireSameOrigin,
  requireUser,
  runApi,
} from "../_shared.js";

export function onRequestPatch(context) {
  return runApi(context, async ({ request, env, params }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const reminderId = requireId(params.id, "El recordatorio");
    const body = await readJson(request);
    if (typeof body?.completed !== "boolean") {
      return json({ detail: "El estado del recordatorio no es válido." }, 422);
    }
    const result = await getDatabase(env)
      .prepare("UPDATE reminders SET completed = ? WHERE id = ? AND user_id = ?")
      .bind(body.completed ? 1 : 0, reminderId, user.id)
      .run();
    if (!result.meta.changes) return json({ detail: "No se encontró ese recordatorio." }, 404);
    return json({ id: reminderId, completed: body.completed });
  });
}

export function onRequestDelete(context) {
  return runApi(context, async ({ request, env, params }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const reminderId = requireId(params.id, "El recordatorio");
    const result = await getDatabase(env)
      .prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?")
      .bind(reminderId, user.id)
      .run();
    if (!result.meta.changes) return json({ detail: "No se encontró ese recordatorio." }, 404);
    return json({ deleted: true });
  });
}
