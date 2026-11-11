import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet as listApplications } from "../functions/api/applications.js";
import { onRequestDelete as deleteApplication } from "../functions/api/applications/[id].js";
import { onRequestPost as addNote } from "../functions/api/applications/[id]/notes.js";
import { onRequestPost as addReminder } from "../functions/api/reminders.js";
import { onRequestGet as sessionStatus } from "../functions/api/auth/me.js";

function fakeDatabase() {
  const calls = [];
  const database = {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);
      const statement = {
        bind(...values) {
          call.values = values;
          return statement;
        },
        async first() {
          if (sql.includes("FROM sessions JOIN users")) return { id: "owner-1", email: "owner@example.com" };
          if (sql.includes("FROM applications WHERE id = ? AND user_id = ?")) return null;
          return null;
        },
        async all() {
          return { results: [{ id: "owner-app", user_id: "owner-1" }] };
        },
        async run() {
          return { meta: { changes: 0 } };
        },
      };
      return statement;
    },
  };
  return database;
}

function context(database, path = "/api/applications", method = "GET", body) {
  return {
    request: new Request(`https://jobtrack.test${path}`, {
      method,
      headers: {
        Cookie: "jobtrack_session=valid-token",
        ...(method !== "GET" ? { Origin: "https://jobtrack.test" } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    env: { DB: database },
    params: { id: "someone-elses-app" },
  };
}

test("application listing is scoped to the authenticated user", async () => {
  const database = fakeDatabase();
  const response = await listApplications(context(database));
  assert.equal(response.status, 200);
  const query = database.calls.find(call => call.sql.includes("FROM applications"));
  assert.match(query.sql, /WHERE user_id = \?/);
  assert.deepEqual(query.values, ["owner-1"]);
});

test("deleting an application is scoped by both record and owner", async () => {
  const database = fakeDatabase();
  const response = await deleteApplication(context(database, "/api/applications/someone-elses-app", "DELETE"));
  assert.equal(response.status, 404);
  const query = database.calls.find(call => call.sql.startsWith("DELETE FROM applications"));
  assert.match(query.sql, /WHERE id = \? AND user_id = \?/);
  assert.deepEqual(query.values, ["someone-elses-app", "owner-1"]);
});

test("notes cannot be attached to another user's application", async () => {
  const database = fakeDatabase();
  const response = await addNote(context(
    database,
    "/api/applications/someone-elses-app/notes",
    "POST",
    { content: "Nota privada" },
  ));
  assert.equal(response.status, 404);
  const ownershipCheck = database.calls.find(call => call.sql.includes("FROM applications WHERE id = ? AND user_id = ?"));
  assert.deepEqual(ownershipCheck.values, ["someone-elses-app", "owner-1"]);
  assert.equal(database.calls.some(call => call.sql.startsWith("INSERT INTO notes")), false);
});

test("reminders cannot reference another user's application", async () => {
  const database = fakeDatabase();
  const response = await addReminder(context(
    database,
    "/api/reminders",
    "POST",
    {
      title: "Seguimiento",
      due_at: "2026-11-12T10:30:00Z",
      application_id: "someone-elses-app",
    },
  ));
  assert.equal(response.status, 404);
  const ownershipCheck = database.calls.find(call => call.sql.includes("FROM applications WHERE id = ? AND user_id = ?"));
  assert.deepEqual(ownershipCheck.values, ["someone-elses-app", "owner-1"]);
  assert.equal(database.calls.some(call => call.sql.startsWith("INSERT INTO reminders")), false);
});

test("unauthenticated visitors cannot read a private application list", async () => {
  const database = fakeDatabase();
  const request = new Request("https://jobtrack.test/api/applications");
  const response = await listApplications({ request, env: { DB: database } });
  assert.equal(response.status, 401);
  assert.equal(database.calls.length, 0);
});

test("anonymous session checks return a normal unauthenticated result", async () => {
  const database = fakeDatabase();
  const request = new Request("https://jobtrack.test/api/auth/me");
  const response = await sessionStatus({ request, env: { DB: database } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: false });
  assert.equal(database.calls.length, 0);
});
