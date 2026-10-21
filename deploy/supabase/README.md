# MES self-hosted Supabase

Based on upstream self-hosted/v0.8.3 (bc27d2661edd09a5d0b8d76ce33da6d4071a756e), with pinned images and initialization SQL.

Production runs in manuqube. Development and staging have independent StatefulSets, PVCs and database/JWT keys. Each backend co-locates Postgres, Auth, PostgREST, Realtime, Storage, Meta, Studio, HTTPS and backup components in one pod. Component traffic stays on loopback; cross-pod access is HTTPS. Postgres binds only to loopback. Studio has its own private hostname and basic authentication behind VPN-only Traefik routing.

prepare.py writes secret-bearing manifests and credentials.json under ignored .local/supabase. Preserve credentials.json for an initialized deployment; regenerating keys is not a rotation procedure. Do not commit generated secrets. Namespace quota ceilings are 8Gi memory/12 CPU; ceilings do not reserve RAM.

Longhorn persists PGDATA and custom database key/config, uploaded files and daily seven-day recovery copies. Database/storage/backup PVC sizes are 32/8/32Gi in production and 16/4/16Gi elsewhere. Backups start after five minutes, then daily. These are local copies, not off-site backups or transaction-consistent DB/file snapshots. One database replica per environment allows recovery with volume reattachment, not zero-downtime database HA.

The frontend uses its own /supabase API prefix. Public GitHub variables: MES_DEV_ANON_KEY, MES_STAGING_ANON_KEY, MES_PROD_ANON_KEY. Runtime Supabase service-role keys stay in Kubernetes Secrets. Node trusts the mounted internal CA using NODE_EXTRA_CA_CERTS.

SMTP requires owner-supplied mail credentials. Signup and email autoconfirm are disabled. Invites, email verification and password recovery require SMTP delivery testing. Admin-created confirmed users can perform acceptance tests.

Deploying this stack does not migrate existing cloud data, auth users or files. Keep cloud untouched until verified exports, imports and acceptance tests succeed. Apply application SQL migrations in filename order, recording checksums. Database changes require explicit operator review and are not applied by arbitrary app commits.

PR Build check validates Node output. dev-* tags publish development; staging-* tags publish staging; main publishes production. Independent release records live on deploy-releases. Preserve Lovable-connected git history.

Certificate SANs must respect the namespace CA's name constraints: use only full *.svc.cluster.local names and names in the environment's permitted domain. Production Studio is mes-studio.manuqube.com and resolves to 10.77.0.1 only via private VPN DNS. No shortened *.svc SANs are issued. The HTTPS sidecar reloads its certificate hourly.

On an empty database, the historical 20260929083647 migration contains only optional mock-machine fixtures referring to three absent demo stations. The runner records that file's checksum with disposition skipped-demo-fixture-missing-parents instead of fabricating production stations or disabling foreign keys. All other 49 files are applied transactionally; all 50 are accounted for. No existing cloud users/data/files were imported.
