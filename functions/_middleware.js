// Page gate for the Cloudflare host.
//
// Pages serves everything in /public directly, so without this a signed-out
// visitor would get the full app shell and watch it throw 401s. This is the
// same door the local server puts in server.mjs, and it stands where
// Cloudflare Access used to: in front of the pages, so none of them have to
// know about signing in.
//
// /api/* is left alone — the Hono app checks sessions itself. The login page
// and the public reorder page a scanned card lands on stay open, as do assets,
// so the login screen can style itself.
import { verifySession, getCookie } from '../src/auth.mjs';
import { requiresSession } from '../src/page-gate.mjs';

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;

  if (!requiresSession(path)) return next();

  const session = getCookie(request.headers.get('cookie'), 'session');
  if (await verifySession(session, env.SESSION_SECRET || '')) return next();

  return Response.redirect(new URL('/login?next=' + encodeURIComponent(path), request.url).toString(), 302);
}
