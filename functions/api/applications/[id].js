import {
  getDatabase,
  json,
  readJson,
  requireId,
  requireSameOrigin,
  requireUser,
  runApi,
  validateApplication,
} from "../_shared.js";

export function onRequestPut(context) {
  return runApi(context, async ({ request, env, params }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const applicationId = requireId(params.id, "La postulación");
    const application = validateApplication(await readJson(request));
    const result = await getDatabase(env)
      .prepare(
        `UPDATE applications
         SET company = ?, position = ?, status = ?, location = ?, work_type = ?,
             salary = ?, url = ?, applied_on = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND user_id = ?`,
      )
      .bind(
        application.company,
        application.position,
        application.status,
        application.location,
        application.work_type,
        application.salary,
        application.url,
        application.applied_on,
        applicationId,
        user.id,
      )
      .run();
    if (!result.meta.changes) return json({ detail: "No se encontró esa postulación." }, 404);
    return json({ id: applicationId, ...application });
  });
}

export function onRequestDelete(context) {
  return runApi(context, async ({ request, env, params }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const applicationId = requireId(params.id, "La postulación");
    const result = await getDatabase(env)
      .prepare("DELETE FROM applications WHERE id = ? AND user_id = ?")
      .bind(applicationId, user.id)
      .run();
    if (!result.meta.changes) return json({ detail: "No se encontró esa postulación." }, 404);
    return json({ deleted: true });
  });
}
