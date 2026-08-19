// Choose-your-own-adventure setup. Asks a few questions, then wires the app for
// EITHER a local server (this machine / a shop PC / a Raspberry Pi) OR Cloudflare
// (free cloud). Writes the config you need and prints the exact next commands.
//
//   npm run setup
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';

// Buffer input lines so answers work whether typed interactively or piped in
// (piped stdin can deliver every line before the next prompt is shown).
const rl = createInterface({ input: stdin });
const pending = [];
let waiting = null;
rl.on('line', (line) => { if (waiting) { const w = waiting; waiting = null; w(line); } else pending.push(line); });
rl.on('close', () => { if (waiting) { const w = waiting; waiting = null; w(null); } });
const nextLine = () => new Promise((res) => { pending.length ? res(pending.shift()) : (waiting = res); });
const ask = async (q, def) => {
  stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
  const line = await nextLine();
  return (line == null ? '' : line).trim() || def || '';
};
const secret = () => randomBytes(24).toString('hex');

console.log(`
  ┌─────────────────────────────────────────────┐
  │   Community Kanban — setup                  │
  └─────────────────────────────────────────────┘

  Two ways to run this. Pick the one that fits your shop:

    1) Local server   — runs on a shop PC or Raspberry Pi on your
                        wifi. Data stays on that box. No internet,
                        no accounts, no monthly bill. Phones on the
                        shop wifi can scan/reorder; off-site can't.

    2) Cloudflare     — free cloud hosting in YOUR own Cloudflare
                        account. Reachable (and QR-scannable) from
                        anywhere. Your data lives in your account;
                        nobody else hosts it. Needs a free signup.
`);

const choice = await ask('  Host on (1) local or (2) cloudflare?', '1');
const mode = choice.startsWith('2') ? 'cloudflare' : 'local';

const shopName = await ask('\n  Shop name (shown in the header)', 'Your Shop');
console.log('\n  Set a shop password. Everyone at the shop uses this one password to get in.');
const shopPassword = await ask('  Shop password');
if (!shopPassword) { console.log('\n  A password is required. Re-run `npm run setup`.\n'); rl.close(); process.exit(1); }
const sessionSecret = secret();

if (mode === 'local') {
  const port = await ask('\n  Port to run on', '8080');
  const dbPath = await ask('  Database file (keep this file backed up)', './data/shop.db');
  if (existsSync('.env') && (await ask('\n  .env already exists — overwrite? (y/N)', 'N')).toLowerCase() !== 'y') {
    console.log('  Left .env alone.'); rl.close(); process.exit(0);
  }
  writeFileSync('.env', [
    '# Community Kanban — local host config. Keep this file out of git (.gitignore already covers it).',
    'HOST_MODE=local',
    `SHOP_NAME=${shopName}`,
    `PORT=${port}`,
    `DB_PATH=${dbPath}`,
    `SHOP_PASSWORD=${shopPassword}`,
    `SESSION_SECRET=${sessionSecret}`,
    '# Optional: paste an Anthropic API key to enable screenshot import.',
    'ANTHROPIC_API_KEY=',
    '',
  ].join('\n'));
  console.log(`
  ✓ Wrote .env

  Next:
    npm run dev

  Then open http://localhost:${port} and sign in with your shop password.
  Other devices on your wifi use http://<this-machine-ip>:${port}.

  Want to see it with data first? `npm run seed:sample` loads five clearly
  labelled example items, and `npm run seed:sample -- --clear` removes them.
`);
} else {
  const project = await ask('\n  Cloudflare project name (lowercase, no spaces)', 'community-kanban');
  writeFileSync('wrangler.toml', [
    `name = "${project}"`,
    'pages_build_output_dir = "public"',
    `compatibility_date = "${new Date().toISOString().slice(0, 10)}"`,
    '',
    '# Fill database_id in after the `wrangler d1 create` step below.',
    '[[d1_databases]]',
    'binding = "DB"',
    `database_name = "${project}"`,
    'database_id = "PASTE_AFTER_CREATE"',
    '',
    '[vars]',
    `SHOP_NAME = "${shopName}"`,
    '',
  ].join('\n'));
  const steps = `# Cloudflare setup — next steps

Generated for project **${project}**. Run these in order:

\`\`\`bash
npm install
npx wrangler login                         # opens your browser, sign in / sign up (free)

# 1. Create your database, then paste the printed database_id into wrangler.toml
npx wrangler d1 create ${project}

# 2. Load the schema into it
npx wrangler d1 execute ${project} --remote --file=src/db/schema.sql

# 3. Set your secrets (paste each value when prompted)
npx wrangler pages secret put SHOP_PASSWORD --project-name ${project}     # value: your shop password
npx wrangler pages secret put SESSION_SECRET --project-name ${project}    # value below

# 4. Deploy
npx wrangler pages deploy public --project-name ${project} --branch main
\`\`\`

Your generated SESSION_SECRET (use it in step 3 — keep it private):

    ${sessionSecret}

Your data lives in the D1 database in **your** Cloudflare account. Nobody else hosts it.
To enable screenshot import later, add an ANTHROPIC_API_KEY secret the same way as step 3.
`;
  writeFileSync('SETUP-NEXT-STEPS.md', steps);
  console.log(`
  ✓ Wrote wrangler.toml and SETUP-NEXT-STEPS.md

  Open SETUP-NEXT-STEPS.md and follow the steps — it has your generated
  SESSION_SECRET and the exact commands for project "${project}".
`);
}

rl.close();
