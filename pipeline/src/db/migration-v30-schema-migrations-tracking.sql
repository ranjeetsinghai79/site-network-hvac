-- Tracks which migration files have actually been applied to this database.
-- Nothing enforced this before — a 2026-08-23 audit found 6 tables that live
-- code depended on had never been migrated in, with no way to detect the
-- drift short of manually diffing every migration file against \dt. Every
-- future migration should be applied via
--   npx tsx src/scripts/apply-migration.ts <file>
-- which runs the file AND records it here, instead of a bare `psql -f`.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,   -- filename, e.g. 'migration-v30-schema-migrations-tracking.sql'
  applied_at  timestamptz NOT NULL DEFAULT NOW()
);
