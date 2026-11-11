const SESSION_COOKIE = "jobtrack_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 100000;
const APPLICATION_STATUSES = ["Aplicado", "Entrevista", "Oferta", "Rechazado", "En espera"];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export function errorResponse(error) {
  if (error instanceof HttpError) return json({ detail: error.message }, error.status);
  console.error("JobTrack Pro API request failed:", error);
  return json({ detail: "Ocurrió un error interno. Inténtalo más tarde." }, 500);
}

export async function runApi(context, handler) {
  try {
    return await handler(context);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readJson(request) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 32768) throw new HttpError(413, "La solicitud es demasiado grande.");
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "El cuerpo de la solicitud debe ser JSON válido.");
  }
}

function requireRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(422, "Los datos enviados no son válidos.");
  }
}

export function requireSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new HttpError(403, "La solicitud no proviene de este sitio.");
  }
}

export function getDatabase(env) {
  if (!env.DB) throw new HttpError(503, "La base de datos de JobTrack Pro no está configurada.");
  return env.DB;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return encodeBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left, right) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function derivePassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: typeof salt === "string" ? decodeBase64Url(salt) : salt,
      iterations: PASSWORD_ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return encodeBase64Url(new Uint8Array(bits));
}

export async function limitRegistration(request, env) {
  const ipAddress = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await sha256(`register\n${ipAddress}`);
  const now = new Date();
  const windowStartedAt = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const database = getDatabase(env);
  const record = await database
    .prepare("SELECT attempts FROM login_attempts WHERE attempt_key = ? AND window_started_at > ?")
    .bind(key, windowStartedAt)
    .first();
  if ((record?.attempts || 0) >= 3) {
    throw new HttpError(429, "Se alcanzó el límite de creación de cuentas. Inténtalo más tarde.");
  }
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
}

export function validateEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(422, "Escribe un correo electrónico válido.");
  }
  return email;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128) {
    throw new HttpError(422, "La contraseña debe tener entre 12 y 128 caracteres.");
  }
  return value;
}

export function validateApplication(body) {
  requireRecord(body);
  const text = (value, label, maximum) => {
    const result = typeof value === "string" ? value.trim() : "";
    if (!result || result.length > maximum) {
      throw new HttpError(422, `${label} es obligatorio y no puede superar ${maximum} caracteres.`);
    }
    return result;
  };
  const optionalText = (value, label, maximum) => {
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new HttpError(422, `${label} debe ser un texto válido.`);
    }
    const result = typeof value === "string" ? value.trim() : "";
    if (result.length > maximum) {
      throw new HttpError(422, `${label} no puede superar ${maximum} caracteres.`);
    }
    return result;
  };
  const status = APPLICATION_STATUSES.includes(body.status) ? body.status : null;
  if (!status) throw new HttpError(422, "Selecciona un estado válido.");
  const appliedOn = typeof body.applied_on === "string" ? body.applied_on : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedOn)) {
    throw new HttpError(422, "La fecha de postulación debe ser válida.");
  }
  const date = new Date(`${appliedOn}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== appliedOn) {
    throw new HttpError(422, "La fecha de postulación debe ser válida.");
  }
  const url = optionalText(body.url, "El enlace", 500);
  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
    } catch {
      throw new HttpError(422, "El enlace debe comenzar con http:// o https://.");
    }
  }
  return {
    company: text(body.company, "La empresa", 120),
    position: text(body.position, "El cargo", 120),
    status,
    location: optionalText(body.location, "La ubicación", 120),
    work_type: optionalText(body.work_type, "La modalidad", 50),
    salary: optionalText(body.salary, "El salario", 100),
    url,
    applied_on: appliedOn,
  };
}

export function validateNote(body) {
  requireRecord(body);
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 2000) {
    throw new HttpError(422, "La nota es obligatoria y no puede superar 2000 caracteres.");
  }
  return content;
}

export function validateReminder(body) {
  requireRecord(body);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 160) {
    throw new HttpError(422, "El recordatorio es obligatorio y no puede superar 160 caracteres.");
  }
  const dueAt = typeof body.due_at === "string" ? body.due_at : "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(dueAt)) {
    throw new HttpError(422, "Indica una fecha y hora válidas para el recordatorio.");
  }
  const date = new Date(dueAt);
  if (Number.isNaN(date.valueOf())) {
    throw new HttpError(422, "Indica una fecha y hora válidas para el recordatorio.");
  }
  let applicationId = null;
  if (body.application_id !== undefined && body.application_id !== null && body.application_id !== "") {
    if (typeof body.application_id !== "string" || body.application_id.length > 80) {
      throw new HttpError(422, "La postulación relacionada no es válida.");
    }
    applicationId = body.application_id;
  }
  return { title, due_at: date.toISOString(), application_id: applicationId };
}

function cookieValue(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([A-Za-z0-9_-]+)`));
  return match?.[1] || null;
}

export async function createSession(env, userId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = encodeBase64Url(tokenBytes);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await getDatabase(env)
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, expiresAt)
    .run();
  return token;
}

export function sessionCookie(token, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export async function requireUser(request, env) {
  const token = cookieValue(request);
  if (!token) throw new HttpError(401, "Inicia sesión para continuar.");
  const tokenHash = await sha256(token);
  const session = await getDatabase(env)
    .prepare(
      `SELECT users.id, users.email
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first();
  if (!session) throw new HttpError(401, "Tu sesión venció. Inicia sesión nuevamente.");
  return { id: session.id, email: session.email };
}

export async function deleteCurrentSession(request, env, userId) {
  const token = cookieValue(request);
  if (!token) return;
  const tokenHash = await sha256(token);
  await getDatabase(env)
    .prepare("DELETE FROM sessions WHERE token_hash = ? AND user_id = ?")
    .bind(tokenHash, userId)
    .run();
}

export function requireId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(value)) {
    throw new HttpError(422, `${label} no es válido.`);
  }
  return value;
}

export function id() {
  return crypto.randomUUID();
}

export async function passwordMatches(password, salt, expectedHash) {
  return constantTimeEqual(await derivePassword(password, salt), expectedHash);
}
