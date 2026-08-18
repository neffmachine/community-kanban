// Local-host config, read from the environment (.env is loaded by `node
// --env-file`, a built-in — no dotenv dependency). On Cloudflare the equivalent
// values come from context.env instead (see functions/api/[[path]].js).
export function loadConfig() {
  const env = process.env;
  const config = {
    hostMode: 'local',
    shopName: env.SHOP_NAME || 'Your Shop',
    port: parseInt(env.PORT, 10) || 8080,
    dbPath: env.DB_PATH || './data/shop.db',
    shopPassword: env.SHOP_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
    anthropicKey: env.ANTHROPIC_API_KEY || '', // optional; enables screenshot import
  };
  if (!config.shopPassword || !config.sessionSecret) {
    console.error('\n  Missing SHOP_PASSWORD or SESSION_SECRET.');
    console.error('  Run `npm run setup` to generate your .env, then `npm run dev` again.\n');
    process.exit(1);
  }
  return config;
}
