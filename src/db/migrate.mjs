// Additive column migrations.
//
// schema.sql is the source of truth for a FRESH database. It cannot update an
// existing one: every statement is `CREATE TABLE IF NOT EXISTS`, which silently
// skips a table that already exists, and SQLite has no `ADD COLUMN IF NOT
// EXISTS`. So new *tables* need nothing here — re-applying the schema creates
// them on both hosts — but new *columns* on an existing table do.
//
// The logic is a pure function so each adapter can apply it in its own idiom:
// the local adapter runs it on every boot, while D1's schema is applied at
// deploy time (see docs/HOSTING.md) and uses the generated file in migrations/.

export const ADDED_COLUMNS = {
  items: {
    minUnit: "TEXT NOT NULL DEFAULT ''",
    reorderUnit: "TEXT NOT NULL DEFAULT ''",
    itemType: "TEXT NOT NULL DEFAULT ''",
    syncGroup: 'TEXT',
    lastOrdered: 'TEXT',
    lastReceived: 'TEXT',
  },
};

// Given the columns a table currently has, the ALTER statements needed to bring
// it up to date. Returns [] when nothing is missing, so it is safe to re-run.
export function missingColumnStatements(table, existingColumns) {
  const have = new Set(existingColumns);
  return Object.entries(ADDED_COLUMNS[table] || {})
    .filter(([name]) => !have.has(name))
    .map(([name, declaration]) => `ALTER TABLE ${table} ADD COLUMN ${name} ${declaration}`);
}
