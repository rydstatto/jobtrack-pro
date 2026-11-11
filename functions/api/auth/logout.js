import {
  deleteCurrentSession,
  json,
  requireSameOrigin,
  runApi,
  requireUser,
  sessionCookie,
} from "../_shared.js";

export function onRequestPost(context) {
  return runApi(context, async ({ request, env }) => {
    requireSameOrigin(request);
    const user = await requireUser(request, env);
    await deleteCurrentSession(request, env, user.id);
    return json(
      { authenticated: false },
      200,
      { "Set-Cookie": sessionCookie("", 0) },
    );
  });
}
