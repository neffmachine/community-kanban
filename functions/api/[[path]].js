// Cloudflare-host entry point: a Pages Function that routes every /api/* request
// through the same Hono app used locally. Data lives in the shop's own D1
// database (their Cloudflare account, not yours). Static files in /public are
// served directly by Pages.
//
// Config comes from Cloudflare environment vars/secrets set during deploy
// (see docs/HOSTING.md): SHOP_NAME (var), SHOP_PASSWORD + SESSION_SECRET
// (secrets), and the D1 binding named DB.
import { handle } from 'hono/cloudflare-pages';
import { createD1Db } from '../../src/db/d1.mjs';
import { createApp } from '../../src/app.mjs';

export const onRequest = (context) => {
  const env = context.env;
  const config = {
    hostMode: 'cloudflare',
    shopName: env.SHOP_NAME || 'Your Shop',
    shopPassword: env.SHOP_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || '',
  };
  const db = createD1Db(env.DB);
  const app = createApp({ db, config });
  return handle(app)(context);
};
