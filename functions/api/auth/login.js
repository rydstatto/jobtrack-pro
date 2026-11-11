import {
  createSession,
  getDatabase,
  HttpError,
  json,
  passwordMatches,
  readJson,
  requireSameOrigin,
  runApi,
  sessionCookie,
  validateEmail,
  validatePassword,
} from "../_shared.js";

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

async function attemptKey(email, ipAddress) {
  const value = new TextEncoder().encode(`${email}\n${ipAddress}`);
  const digest = await crypto.subtle.digest("SHA-256", value);
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function onRequestPost(context) {
  return runApi(context, async ({ request, env }) => {
    requireSameOrigin(request);
    const body = await readJson(request);
    const email = validateEmail(body?.email);
    const password = validatePassword(body?.password);
    const database = getDatabase(env);
    const ipAddress = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = await attemptKey(email, ipAddress);
    const now = new Date();
    const windowStartedAt = new Date(now.getTime() - WINDOW_SECONDS * 1000).toISOString();
    const attempts = await database
      .prepare("SELECT attempts FROM login_attempts WHERE attempt_key = ? AND window_started_at > ?")
      .bind(key, windowStartedAt)
      .first();
    if ((attempts?.attempts || 0) >= MAX_ATTEMPTS) {
      throw new HttpError(429, "Demasiados intentos. Espera 15 minutos e inténtalo otra vez.");
    }

    const user = await database
      .prepare("SELECT id, email, password_hash, password_salt FROM users WHERE email = ?")
      .bind(email)
      .first();
    const salt = user?.password_salt || "AAAAAAAAAAAAAAAAAAAAAA";
    const expectedHash = user?.password_hash || "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const valid = await passwordMatches(password, salt, expectedHash);
    if (!user || !valid) {
      await database
        .prepare(
          `INSERT INTO login_attempts (attempt_key, attempts, window_started_at)
           VALUES (?, 1, ?)
           ON CONFLICT(attempt_key) DO UPDATE SET
             attempts = CASE
               WHEN login_attempts.window_started_at <= ? THEN 1
               ELSE login_attempts.attempts + 1
             END,
             window_started_at = CASE
               WHEN login_attempts.window_started_at <= ? THEN excluded.window_started_at
               ELSE login_attempts.window_started_at
             END`,
        )
        .bind(key, now.toISOString(), windowStartedAt, windowStartedAt)
        .run();
      throw new HttpError(401, "Correo o contraseña incorrectos.");
    }

    await database
      .prepare("DELETE FROM login_attempts WHERE attempt_key = ?")
      .bind(key)
      .run();
    await database
      .prepare("DELETE FROM login_attempts WHERE window_started_at < ?")
      .bind(windowStartedAt)
      .run();
    const token = await createSession(env, user.id);
    return json(
      { authenticated: true, user: { id: user.id, email: user.email } },
      200,
      { "Set-Cookie": sessionCookie(token) },
    );
  });
}
