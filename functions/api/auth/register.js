import {
  createSession,
  getDatabase,
  HttpError,
  id,
  json,
  limitRegistration,
  readJson,
  requireSameOrigin,
  runApi,
  sessionCookie,
  derivePassword,
  validateEmail,
  validatePassword,
} from "../_shared.js";

export function onRequestPost(context) {
  return runApi(context, async ({ request, env }) => {
    requireSameOrigin(request);
    const body = await readJson(request);
    const email = validateEmail(body?.email);
    const password = validatePassword(body?.password);
    const database = getDatabase(env);
    await limitRegistration(request, env);
    const userId = id();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltEncoded = btoa(String.fromCharCode(...salt))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const passwordHash = await derivePassword(password, saltEncoded);

    try {
      await database
        .prepare("INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
        .bind(userId, email, passwordHash, saltEncoded)
        .run();
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE constraint failed")) {
        throw new HttpError(409, "Ya existe una cuenta con ese correo.");
      }
      throw error;
    }

    const token = await createSession(env, userId);
    return json(
      { authenticated: true, user: { id: userId, email } },
      201,
      { "Set-Cookie": sessionCookie(token) },
    );
  });
}
