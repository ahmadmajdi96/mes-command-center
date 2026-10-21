#!/bin/bash
set -euo pipefail
umask 077
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS mes_deploy;
REVOKE ALL ON SCHEMA mes_deploy FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS mes_deploy.migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
SQL
for file in /tmp/mes-migrations/*.sql; do
 name=$(basename "$file")
 digest=$(sha256sum "$file" | cut -d ' ' -f1)
 existing=$(psql -U supabase_admin -d postgres -Atc "SELECT checksum FROM mes_deploy.migrations WHERE version='$name'")
 if [ -n "$existing" ]; then
  test "$existing" = "$digest" || { echo "Checksum mismatch: $name"; exit 1; }
  continue
 fi
 { printf 'BEGIN;\n'; cat "$file"; printf "\nINSERT INTO mes_deploy.migrations(version,checksum) VALUES ('%s','%s');\nCOMMIT;\n" "$name" "$digest"; } | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q > /tmp/mes-migration.log 2>&1 || { echo "Failed: $name"; tail -10 /tmp/mes-migration.log; exit 1; }
 echo "Applied: $name"
done
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO storage.buckets(id,name,public) VALUES ('mes-evidence','mes-evidence',false),('attachments','attachments',false) ON CONFLICT(id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS verified_migrations FROM mes_deploy.migrations;
SQL
