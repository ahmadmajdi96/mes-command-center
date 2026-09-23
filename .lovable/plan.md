# Audit response — Stage 1: lock down access and unify identity

The audit lists 50 items across five stages. Stages 2-5 (execution engine, edge app platform, plant operations, production readiness) each need their own build turns and several need decisions from you first (see the end). This plan delivers **Stage 1 in full**, because everything else is unsafe to build on top of today's open data access.

Stage 1 exit gate from the audit: *no anonymous access to operational data, two terminals share the same state, every record carries the real person who made it.*

## What changes for you

1. **Nobody can read or change production data without signing in.** Right now the database itself accepts anonymous reads and writes for products, orders, batches, units, readings, recipes, waste, holds and events — the login screen only hides the screens, not the data. All of that becomes sign-in-only.
2. **Roles actually decide what a person can do.** Today any signed-in account reaches everything. After this: operators execute and record, supervisors dispatch and approve exceptions, quality approvers release holds, planners plan, admins administer. Someone without a role gets a "no access yet" screen instead of the full app.
3. **One person, one identity.** The workforce list and the login accounts are two separate lists today, so an operator's actions can't be reliably tied to a real account. They get linked, and deactivating a person removes their access while keeping their history.
4. **Every action records who really did it.** Records currently default to a demo person. They will carry the signed-in account, the time and the reason.
5. **Production history stops being editable.** Station entry/exit events and readings become append-only: corrections are recorded as new linked entries, and deleting an order no longer erases the production history behind it.
6. **The five open data endpoints stop being public.** They require a service key; a small deliberately-minimal summary endpoint stays open for dashboards.
7. **Demo seeding is fenced off.** The "Seed database" button becomes admin-only and refuses to run when the app is marked as a live environment.
8. **Evidence files are scoped.** Photos and documents can only be read by people authorized for that record, links expire, and released evidence can't be overwritten.

## Items closed this turn

MES-01, MES-02, MES-03, MES-04 (partial — see below), MES-05, MES-06, MES-07, MES-09, MES-10.

MES-04 note: the browser-local store still holds lines, stations, legacy work orders, assignments, downtime, quality holds and genealogy. This turn moves **users/assignments, downtime, quality holds and audit** to the database (the identity- and attribution-critical ones). Lines, stations and legacy work-order execution move in the Stage 2 turn together with the execution state machine, because splitting them from that work would break both.

## Technical plan

**Migration 1 — authorization model**
- `organizations`, `sites`, `areas` added above the existing `lines`; `lines.site_id`, `stations` inherit scope through the line.
- `permissions` (action keys), `role_permissions` seeded per role, `scoped_grants` (user, permission, scope level + id, effective dates, qualification condition). New roles added to `app_role`: `planner`, `process_engineer`, `quality_inspector`, `quality_approver`, `maintenance`, `material_handler`, `app_builder`, `app_publisher`.
- Security-definer helpers: `public.has_permission(_user, _action, _scope_kind, _scope_id)`, `public.user_sites(_user)`, `public.is_platform_admin(_user)` — all `STABLE SECURITY DEFINER SET search_path = public`.
- `mes_users.auth_user_id uuid` → `auth.users`, plus `active boolean`; `profiles` stays the display record.

**Migration 2 — RLS replacement**
Drop every `public …USING (true)` policy on: products, production_orders, production_batches, product_units, unit_events, unit_readings, product_station_recipes, waste_events, waste_reasons, station_waste_reasons, station_holds. Replace with `TO authenticated` policies gated on `has_permission(auth.uid(), '<action>', 'site', site_of_row)`. Revoke all `anon` grants on operational tables. `lines`, `stations`, `work_orders`, `downtime_events`, `quality_holds`, `genealogy_records`, `mes_users`, `audit_entries`: drop `TO public` read policies, re-grant to `authenticated` under read permissions, add write policies (these tables currently have no write path at all).

**Migration 3 — append-only history**
- `unit_events`, `unit_readings`, `waste_events`, `audit_entries`: no UPDATE/DELETE policies; `BEFORE UPDATE OR DELETE` triggers raise. Corrections use `corrects_event_id` + `correction_reason` columns on a new row.
- Drop `ON DELETE CASCADE` from `product_units.production_order_id` / `batch_id` and `unit_events.unit_uid`; switch to `ON DELETE RESTRICT`.
- `recalc_batch_and_order_progress` extended to fire on DELETE and to reconcile the **old** parent on reassignment (MES-22 partial, needed here because the trigger is being touched anyway).
- `audit_entries.actor_id` becomes `uuid` referencing `auth.users`, plus `session_id`, `correlation_id`, `reason`, `device_id`.

**Server functions** (`src/lib/mes/*.functions.ts`, all `.middleware([requireSupabaseAuth])`)
- `authz.functions.ts` — `getMyAccess()` returns permissions + scopes; cached in router context.
- `execution.functions.ts` — `recordUnitEvent`, `recordReading`, `recordWaste`, `openHold`, `closeHold`: single server entry per action, permission-checked, actor derived from `context.userId`, never from the client. Client mutation hooks in `units-db.ts` / `hmi-db.ts` are re-pointed at these; the direct `supabase.from(...).insert` calls for these paths are removed.
- `seed.functions.ts` — add `requireSupabaseAuth` + `is_platform_admin` check + refuse unless `ALLOW_DEMO_SEED=true`.
- `evidence.functions.ts` — signed-URL issuance moves server-side, checks record scope, 5-minute expiry; storage policies rewritten to require an authorized grant rather than bucket name.

**Client**
- `src/lib/access.tsx` — `AccessProvider` + `useCan(action, scope)`; sidebar, page actions and buttons hide/disable from it.
- `src/routes/_authenticated/route.tsx` — after the existing `getUser()` check, load `getMyAccess()`; when a user has no grants, render a "Access not yet assigned" panel instead of `<Outlet />`. No second redirect gate.
- `src/routes/_authenticated/no-access.tsx`, plus role/grant administration on `users.index.tsx` (invite, activate, suspend, grant scoped role) — admin-permission-gated.
- Generic form dialog (`components/crud/entity-form-dialog.tsx`) awaits submission, keeps input on failure, shows the real error, disables double submit (MES-43, required so the new permission denials are visible rather than silently "saved").

**APIs**
- `src/routes/api/public/mes/{kpi,work-orders,downtime,quality-holds,traceability}.ts` move to `src/routes/api/mes/v1/*` with a `MES_API_KEY` bearer check, pagination and no operator PII; CORS narrowed to a configured origin list. A single minimized `api/public/mes/v1/summary` remains anonymous (aggregate counts only).
- Secret needed: `MES_API_KEY` (I'll request it), plus `ALLOW_DEMO_SEED`.

**Verification before I report done:** signed-out and role-less direct database/API calls must fail for each locked table; a second browser profile signed in as an operator must be denied hold release and recipe edit; an update/delete against `unit_events` must be rejected; deleting an order with units must be refused; a forced network failure must not show "saved".

## Decisions needed for Stage 2+

The audit's own sizing questions I need answered before the execution engine and edge platform turns: serialized units vs bulk lots (or both), one enterprise or multi-customer platform, what "edge app" means here (browser kiosk / offline PWA / gateway-hosted), which PLC protocols and machine commands are permitted, and which system of record owns orders and stock. Stage 1 does not depend on any of these.
