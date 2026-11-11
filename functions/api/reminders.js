import {
  getDatabase,
  id,
  json,
  readJson,
  requireSameOrigin,
  requireUser,
  runApi,
  validateReminder,
} from "./_shared.js";

export function onRequestGet(context) {
  return runApi(context, async ({ request, env }) => {
    const user = await requireUser(request, env);
    const { results } = await getDatabase(env)
      .prepare(
        `SELECT reminders.id, reminders.application_id, reminders.title, reminders.due_at,
                reminders.completed, reminders.created_at,
                applications.company, applications.position
         FROM reminders
         LEFT JOIN applications
           ON applications.id = reminders.application_id AND applications.user_id = reminders.user_id
         WHERE reminders.user_id = ?
         ORDER BY reminders.completed ASC, reminders.due_at ASC`,
      )
      .bind(user.id)
      .all();
    return json({ reminders: results });
  });
}

export function onRequestPost(context) {
  return runApi(context, async ({ request, env }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const reminder = validateReminder(await readJson(request));
    const database = getDatabase(env);
    if (reminder.application_id) {
      const application = await database
        .prepare("SELECT id FROM applications WHERE id = ? AND user_id = ?")
        .bind(reminder.application_id, user.id)
        .first();
      if (!application) return json({ detail: "No se encontró esa postulación." }, 404);
    }
    const reminderId = id();
    await database
      .prepare(
        "INSERT INTO reminders (id, user_id, application_id, title, due_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(reminderId, user.id, reminder.application_id, reminder.title, reminder.due_at)
      .run();
    return json({ id: reminderId, ...reminder, completed: 0 }, 201);
  });
}
