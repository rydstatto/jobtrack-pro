import {
  getDatabase,
  id,
  json,
  readJson,
  requireSameOrigin,
  requireUser,
  runApi,
  validateApplication,
} from "./_shared.js";

export function onRequestGet(context) {
  return runApi(context, async ({ request, env }) => {
    const user = await requireUser(request, env);
    const { results } = await getDatabase(env)
      .prepare(
        `SELECT id, company, position, status, location, work_type, salary, url, applied_on,
                created_at, updated_at
         FROM applications
         WHERE user_id = ?
         ORDER BY applied_on DESC, created_at DESC`,
      )
      .bind(user.id)
      .all();
    return json({ applications: results });
  });
}

export function onRequestPost(context) {
  return runApi(context, async ({ request, env }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const application = validateApplication(await readJson(request));
    const applicationId = id();
    await getDatabase(env)
      .prepare(
        `INSERT INTO applications
          (id, user_id, company, position, status, location, work_type, salary, url, applied_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        applicationId,
        user.id,
        application.company,
        application.position,
        application.status,
        application.location,
        application.work_type,
        application.salary,
        application.url,
        application.applied_on,
      )
      .run();
    return json({ id: applicationId, ...application }, 201);
  });
}
