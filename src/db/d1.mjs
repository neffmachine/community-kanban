// Cloudflare D1 adapter. Wraps the D1 binding in the same async interface the
// SQLite adapter exposes, so src/app.mjs is identical on both hosts.
//
// Note: D1's schema is applied once at deploy time via
//   wrangler d1 execute <db> --remote --file=src/db/schema.sql
// (see docs/HOSTING.md), not on each request — Workers are stateless and
// re-running the schema every request would waste a round-trip.
export function createD1Db(binding) {
  return {
    async all(sql, params = []) {
      const res = await binding.prepare(sql).bind(...params).all();
      return res.results;
    },
    async get(sql, params = []) {
      return await binding.prepare(sql).bind(...params).first();
    },
    async run(sql, params = []) {
      const res = await binding.prepare(sql).bind(...params).run();
      return { changes: res.meta.changes, lastInsertRowid: res.meta.last_row_id };
    },
    async exec(sql) {
      await binding.exec(sql);
    },
  };
}
