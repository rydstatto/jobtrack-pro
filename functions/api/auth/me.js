import { HttpError, json, requireUser, runApi } from "../_shared.js";

export function onRequestGet(context) {
  return runApi(context, async ({ request, env }) => {
    try {
      const user = await requireUser(request, env);
      return json({ authenticated: true, user });
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        return json({ authenticated: false });
      }
      throw error;
    }
  });
}
