import assert from "node:assert/strict";
import test from "node:test";
import {
  derivePassword,
  limitRegistration,
  passwordMatches,
  requireSameOrigin,
  validateApplication,
  validateEmail,
  validatePassword,
  validateReminder,
} from "../functions/api/_shared.js";

test("normalizes valid email and rejects malformed addresses", () => {
  assert.equal(validateEmail("  User@Example.com "), "user@example.com");
  assert.throws(() => validateEmail("not-an-email"), { status: 422 });
  assert.throws(() => validateEmail("user@example"), { status: 422 });
});

test("requires a long password without transforming it", () => {
  assert.equal(validatePassword("  long password  "), "  long password  ");
  assert.throws(() => validatePassword("short"), { status: 422 });
  assert.throws(() => validatePassword("x".repeat(129)), { status: 422 });
});

test("validates application fields, status and external links", () => {
  const application = validateApplication({
    company: "  NovaTech ",
    position: " Product Designer ",
    status: "Entrevista",
    applied_on: "2026-11-11",
    location: "",
    work_type: "Remoto",
    salary: "",
    url: "https://example.com/role",
  });
  assert.equal(application.company, "NovaTech");
  assert.equal(application.position, "Product Designer");
  assert.equal(application.status, "Entrevista");
  assert.throws(() => validateApplication({
    company: "Empresa",
    position: "Cargo",
    status: "Otro",
    applied_on: "2026-11-11",
  }), { status: 422 });
  assert.throws(() => validateApplication({
    company: "Empresa",
    position: "Cargo",
    status: "Aplicado",
    applied_on: "2026-02-31",
    url: "javascript:alert(1)",
  }), { status: 422 });
});

test("requires time-zone-aware reminder timestamps", () => {
  assert.deepEqual(
    validateReminder({
      title: "Seguimiento",
      due_at: "2026-11-12T10:30:00-04:00",
      application_id: "application-1",
    }),
    {
      title: "Seguimiento",
      due_at: "2026-11-12T14:30:00.000Z",
      application_id: "application-1",
    },
  );
  assert.throws(() => validateReminder({ title: "Seguimiento", due_at: "2026-11-12T10:30" }), { status: 422 });
  assert.throws(() => validateReminder({
    title: "Seguimiento",
    due_at: "2026-11-12T10:30:00Z",
    application_id: 123,
  }), { status: 422 });
});

test("derives passwords with per-account salts", async () => {
  const saltA = crypto.getRandomValues(new Uint8Array(16));
  const saltB = crypto.getRandomValues(new Uint8Array(16));
  const encoded = bytes => Buffer.from(bytes).toString("base64url");
  const hashA = await derivePassword("a sufficiently long password", encoded(saltA));
  const hashB = await derivePassword("a sufficiently long password", encoded(saltB));
  assert.notEqual(hashA, hashB);
  assert.equal(await passwordMatches("a sufficiently long password", encoded(saltA), hashA), true);
  assert.equal(await passwordMatches("a different password", encoded(saltA), hashA), false);
});

test("rejects state-changing requests without an exact same-site origin", () => {
  assert.doesNotThrow(() => requireSameOrigin(new Request("https://jobtrack.test/api", {
    method: "POST",
    headers: { Origin: "https://jobtrack.test" },
  })));
  assert.throws(() => requireSameOrigin(new Request("https://jobtrack.test/api", { method: "POST" })), { status: 403 });
  assert.throws(() => requireSameOrigin(new Request("https://jobtrack.test/api", {
    method: "POST",
    headers: { Origin: "https://attacker.test" },
  })), { status: 403 });
});

test("stops registration when the IP-based account limit is reached", async () => {
  const calls = [];
  const database = {
    prepare(sql) {
      const statement = {
        bind(...values) {
          calls.push({ sql, values });
          return statement;
        },
        async first() {
          return { attempts: 3 };
        },
      };
      return statement;
    },
  };
  await assert.rejects(
    limitRegistration(
      new Request("https://jobtrack.test/api/auth/register", {
        headers: { "CF-Connecting-IP": "192.0.2.10" },
      }),
      { DB: database },
    ),
    { status: 429 },
  );
  assert.equal(calls.length, 1);
});
