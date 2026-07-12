# Turn 1 — Migrate MES to Lovable Cloud, wire KPIs + traceability

Lovable Cloud is now enabled. This turn migrates the MES data layer to a real Postgres database, seeds it from the existing deterministic 90-day dataset, and switches the two most demanded read surfaces — the Control Center dashboard KPIs and the Traceability page — off the in-memory `MesStoreProvider` and onto the DB. Everything else (Work Orders, Stations, Downtime pages, mutations, realtime, PDF verify, drill-downs, cross-project wiring) stays on the in-memory store this turn and moves in follow-up turns.

## Scope this turn

1. **Schema (migration).** Public-readable, no auth yet — matches current app posture. Tables mirror the existing types 1:1 so the port is mechanical:
   - `lines`, `stations`, `work_orders`
   - `downtime_events`, `quality_holds`, `genealogy_records`
   - `audit_entries` (indexed on `at`, `entity`, `entity_id` — this is the hot read path for traceability)
   - `mes_users`, `assignments` (used by traceability filters)
   - Each table: `GRANT SELECT` to `anon`+`authenticated`, `GRANT ALL` to `service_role`, RLS enabled with a permissive `TO anon` read policy (public read-only shop floor data), writes restricted to `service_role` for now.

2. **Seed once.** Idempotent server function `seedMesFromFixtures` that reads the existing deterministic fixtures (`src/lib/mes-data.ts` + `audit-seed.ts`) and upserts into the DB. Triggered by a one-click **Seed database** button in `settings.tsx` and a `SELECT count(*)` guard so it's safe to click twice.

3. **Server-fn reads** (client-safe `.functions.ts` under `src/lib/mes/`):
   - `getKpiSummary()` → `{ uptimeWeighted, downtimePareto[], onTimeCompletion, activeWO, holdsOpen, downCount }`
   - `getTraceability(filters)` → `{ entries[], relatedLines, relatedWorkOrders }` supporting date range, plant, line, station, work order, operator, entity type.
   - Both use a server-local Supabase client with the publishable key (RLS as `anon`).

4. **Wire the UI reads only** (no store surgery):
   - `src/routes/index.tsx` — KPI widgets fetch via `useSuspenseQuery(getKpiSummary)` with a 30s `staleTime`. Fall back to in-memory computation if the DB is empty (`activeWO === 0 && auditCount === 0`) so the dashboard never looks broken pre-seed.
   - `src/routes/traceability.tsx` — the audit timeline query switches to `useSuspenseQuery(getTraceability, filters)`; filter UI and PDF export code are untouched. Same empty-DB fallback.
   - All other routes keep reading from `MesStoreProvider` this turn. Writes still go to the in-memory store. This is intentional: it keeps the turn shippable and reversible.

## Deferred to follow-up turns

- Port every route's mutations to server fns / DB writes.
- Realtime KPI refresh (Supabase Realtime channels on `downtime_events` + `work_orders` + `audit_entries`).
- Cross-project wiring: expose stable `/api/public/mes/*` endpoints for the 4 sibling apps + port QC hold / command center widgets from `CORTA QC System` and `Unified Command Center`.
- End-to-end PDF export verify against DB-backed data with all filters + genealogy.
- Drill-down navigation: KPI widget → filtered traceability → filtered work-order list.

## Technical notes

- **Schema shape.** `id` columns stay `text` primary keys (e.g. `WO-2401-118`, `AU-04123`) to preserve existing IDs from fixtures — the fixtures encode meaning in the ID format. Timestamps are `timestamptz`. Enum-like columns (`status`, `entity`, `action`) stored as `text` with CHECK constraints to keep the migration simple.
- **Import graph.** Server fns live in `src/lib/mes/*.functions.ts`. They instantiate the publishable-key client inline inside `.handler()` — no top-level `client.server` import. The seed function reads fixtures via a static import (client-safe).
- **RLS posture matches current app.** No user auth in the app today; shop-floor data is treated as public within the deployment. RLS is on, `anon` gets read-only, writes are `service_role` only until auth lands.
- **PDF export.** Stays client-side against whatever `traceability.tsx` renders; once the read is DB-backed, the export automatically reflects DB data. Full end-to-end verify happens in the PDF turn.

## Files

Create:
- `supabase/migrations/<ts>_mes_core.sql` — tables + grants + RLS + indexes.
- `src/lib/mes/kpi.functions.ts` — `getKpiSummary`.
- `src/lib/mes/traceability.functions.ts` — `getTraceability`.
- `src/lib/mes/seed.functions.ts` — `seedMesFromFixtures` (uses `supabaseAdmin` via lazy import).

Edit:
- `src/routes/index.tsx` — swap KPI widget data source to server fn (keep fallback).
- `src/routes/traceability.tsx` — swap audit list to server fn (keep filters + PDF as-is).
- `src/routes/settings.tsx` — add "Seed database" button.

Untouched this turn: mes-store.tsx, mes-data.ts, audit-seed.ts, every other route.
