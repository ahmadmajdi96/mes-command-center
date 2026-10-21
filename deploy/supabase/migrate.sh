#!/bin/bash
set -euo pipefail
umask 077
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE SCHEMA IF NOT EXISTS mes_deploy;
REVOKE ALL ON SCHEMA mes_deploy FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS mes_deploy.migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE mes_deploy.migrations ADD COLUMN IF NOT EXISTS disposition text NOT NULL DEFAULT 'applied';
SQL
for file in /tmp/mes-migrations/*.sql; do
 name=$(basename "$file")
 digest=$(sha256sum "$file" | cut -d ' ' -f1)
 existing=$(psql -U supabase_admin -d postgres -Atc "SELECT checksum FROM mes_deploy.migrations WHERE version='$name'")
 if [ -n "$existing" ]; then
  test "$existing" = "$digest" || { echo "Checksum mismatch: $name"; exit 1; }
  continue
 fi
 if [ "$name" = "20260929083647_3ccc1804-d5ac-4b76-b9d5-63fe1dfc0a1d.sql" ]; then
  parents=$(psql -U supabase_admin -d postgres -Atc "SELECT count(*) FROM public.stations WHERE id IN ('ST-SIFT-01','ST-PACK-01','ST-MILL-01')")
  if [ "$parents" != 3 ]; then
   psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -c "INSERT INTO mes_deploy.migrations(version,checksum,disposition) VALUES ('$name','$digest','skipped-demo-fixture-missing-parents')"
   echo "Skipped optional mock-machine fixtures (missing demo stations): $name"
   continue
  fi
 fi
 { printf 'BEGIN;\n'; cat "$file"; printf "\nINSERT INTO mes_deploy.migrations(version,checksum) VALUES ('%s','%s');\nCOMMIT;\n" "$name" "$digest"; } | psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q > /tmp/mes-migration.log 2>&1 || { echo "Failed: $name"; tail -10 /tmp/mes-migration.log; exit 1; }
 echo "Applied: $name"
done
psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO storage.buckets(id,name,public) VALUES ('mes-evidence','mes-evidence',false),('attachments','attachments',false) ON CONFLICT(id) DO NOTHING;
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS verified_migrations FROM mes_deploy.migrations;
SQL
