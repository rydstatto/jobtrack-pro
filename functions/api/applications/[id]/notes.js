import {
  getDatabase,
  id,
  json,
  readJson,
  requireId,
  requireSameOrigin,
  requireUser,
  runApi,
  validateNote,
} from "../../_shared.js";

async function ownedApplication(database, applicationId, userId) {
  return database
    .prepare("SELECT id FROM applications WHERE id = ? AND user_id = ?")
    .bind(applicationId, userId)
    .first();
}

export function onRequestGet(context) {
  return runApi(context, async ({ request, env, params }) => {
    const user = await requireUser(request, env);
    const applicationId = requireId(params.id, "La postulación");
    const database = getDatabase(env);
    if (!(await ownedApplication(database, applicationId, user.id))) {
      return json({ detail: "No se encontró esa postulación." }, 404);
    }
    const { results } = await database
      .prepare(
        `SELECT id, content, created_at FROM notes
         WHERE application_id = ? AND user_id = ?
         ORDER BY created_at DESC`,
      )
      .bind(applicationId, user.id)
      .all();
    return json({ notes: results });
  });
}

export function onRequestPost(context) {
  return runApi(context, async ({ request, env, params }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    const applicationId = requireId(params.id, "La postulación");
    const content = validateNote(await readJson(request));
    const database = getDatabase(env);
    if (!(await ownedApplication(database, applicationId, user.id))) {
      return json({ detail: "No se encontró esa postulación." }, 404);
    }
    const noteId = id();
    await database
      .prepare("INSERT INTO notes (id, user_id, application_id, content) VALUES (?, ?, ?, ?)")
      .bind(noteId, user.id, applicationId, content)
      .run();
    const note = await database
      .prepare("SELECT id, content, created_at FROM notes WHERE id = ? AND user_id = ?")
      .bind(noteId, user.id)
      .first();
    return json(note, 201);
  });
}
