# Backend documentation — Cortanex MES

Last updated: 2026-09-23 (Stage 2, Turn A complete)

Backend: Lovable Cloud (Postgres + auth + storage + realtime). App-internal
server logic uses TanStack `createServerFn`; external integrations use file
routes under `src/routes/api/`.

## Tenancy

- `organizations` is the tenant root; `sites` → `areas` → `lines` → `stations`.
- Every operational table carries `organization_id` (NOT NULL).
- `public.user_orgs(uuid)` and `public.in_my_org(text)` are SECURITY DEFINER
  helpers used by every RLS policy, so one company can never read another's rows.

## Access control

- Roles/permissions: `roles`, `permissions`, `role_permissions`,
  `user_role_grants` (scoped, with effective dates), plus `user_roles`
  (`app_role`: admin/supervisor/operator/viewer).
- Helpers: `has_role`, `has_action`, `has_permission`, `scope_ancestors`,
  `is_platform_admin`, `can_admin_users`.
- Client side: `AccessProvider`, `useCan`, `useCanAny`, `Can` in `src/lib/access.tsx`.
- Permission keys added in Stage 2: `execution.rework`, `orders.lifecycle`,
  `machines.command` (reserved for machine commanding).

## Production model

`products` → `production_orders` → `production_batches` → `product_units`,
with `unit_events` / `unit_readings` as append-only history.

- `lines.tracking_mode` = `serial` (track every piece) or `lot` (track quantities).
- `lines.enforce_route` forces station sequence order.
- `product_station_recipes` carries `is_ccp`, `blocks_on_fail`, `requires_reading`.
- `batch_station_progress` records lot-mode quantities (in/good/rework/scrap),
  append-only with linked corrections.

### Lifecycle

Order/batch status: `scheduled → released → running → paused/hold → completed →
closed/cancelled`. Enforced by `guard_order_lifecycle` and
`guard_batch_lifecycle`; illegal jumps and finishing with open items are rejected
by the database, not just the UI. `assert_status_transition` holds the allowed sets.

### Reconciliation

`recalc_batch_and_order_progress` and `recalc_from_lot_progress` keep
`qty_good` / `qty_rework` / `qty_scrap` consistent from item events and lot
progress up to batch and order level.

## Append-only history

`unit_events`, `unit_readings`, `waste_events`, `audit_entries` and
`batch_station_progress` deny UPDATE/DELETE. Corrections are new rows linked via
`corrects_*_id` + `correction_reason`, and carry the real actor
(`actor_user_id`, `device_id`, `session_id`, `correlation_id`).

## Server functions

| File | Purpose |
| --- | --- |
| `src/lib/mes/authz.functions.ts` | `getMyAccess`, admin-gated role grant/revoke/scope |
| `src/lib/mes/execution.functions.ts` | `validateStationMove`, `recordUnitEvent`, `recordLotProgress`, `recordReading`, `recordWaste`, `sendToRework`, `reopenUnit`, station holds |
| `src/lib/mes/orders.functions.ts` | `setOrderStatus`, `setBatchStatus`, `nextStatuses` |
| `src/lib/mes/evidence.functions.ts` | Evidence upload (15 MB) + short-lived view URLs |
| `src/lib/mes/kpi.functions.ts` | KPI aggregation |
| `src/lib/mes/seed.functions.ts` | Demo seed, admin-only (`ALLOW_DEMO_SEED=true`) |

All of them derive the acting person from the session; no client-supplied operator identity is trusted.

`validateStationMove` refuses, with an explicit reason: out-of-route scans,
skipped critical steps, missing or out-of-limit required readings, any open hold
at unit/batch/order/station level, and item scans on lot-mode lines.

## Integration APIs

- `src/routes/api/mes/v1/*` — `work-orders`, `downtime`, `quality-holds`,
  `traceability`, `kpi`. Require an API key (`Authorization: Bearer` or
  `x-api-key`) and return only the calling company's rows.
- Keys live hashed in `api_keys` (org, label, active, last_used_at); the
  platform-wide `MES_API_KEY` secret sees every company.
- `src/routes/api/public/mes/summary` — aggregate counts only, no records,
  no identifiers, no people.
- CORS allow-list via `MES_API_ALLOWED_ORIGINS`.

## Storage

Private `mes-evidence` bucket, service-role only; files are read through
signed URLs issued by `evidence.functions.ts`.

## Auth

Email/password with auto-confirm enabled, anonymous sign-ups disabled, leaked
password protection on. `profiles` + `handle_new_user` trigger create a profile
row per user. All app pages sit under `src/routes/_authenticated/`.

## Known linter notes

Seven "signed-in users can execute SECURITY DEFINER function" warnings cover the
RLS helper functions listed above; they are intentional and required by the policies.

## Not yet built (Stage 2 remainder)

- Turn B — line-side box: offline recording at the line, sync and conflict flagging.
- Turn C — machine read/command: live values plus start/stop/setpoint commands,
  permission-gated and hold-blocked. Needs safety sign-off and the machine/protocol list.
