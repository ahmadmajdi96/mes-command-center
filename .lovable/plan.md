# Stage 2 — execution engine, tenant separation, and line-side boxes

Your four answers change the shape of the work: both item-level and lot-level production, several customer companies on one system, station screens running on a box at the line, and the system allowed to both read and command machines. Stage 2 is too large for one turn, so it is split into three turns. This plan covers **Turn A** in full and states what Turns B and C will do.

## What changes for you

**Turn A — the rules of production (this turn)**

1. **Customer separation.** Every record (products, orders, batches, items, stations, people, history) is tied to one customer company. Someone from one company cannot see or touch another's data, even by accident, and even through the shared data feeds.
2. **Lot-mode and item-mode lines.** Each line is marked as either "track every piece" or "track quantities as lots". Lot lines record quantity good / quantity scrapped at each station instead of scanning pieces; item lines keep the code-per-piece flow you have now. Both feed the same history and traceability.
3. **A real order lifecycle.** Orders and batches can only move through allowed steps: planned → released → running → paused → finished → closed (or cancelled). Skipping steps is refused with a clear reason, so a batch can't be "finished" while items are still open at a station.
4. **Station rules enforced, not just displayed.** A piece cannot be recorded at a station out of route order, cannot skip a step marked critical, cannot pass when a required reading is missing or out of limits, and cannot move while its order, batch or station is on hold. Each refusal says exactly what is wrong.
5. **Rework and correction paths.** A rejected piece can be sent to rework and re-enter the route under supervisor approval; corrections stay recorded as new linked entries, never edits.
6. **Yield and scrap that always add up.** Good, reworked and scrapped quantities are reconciled per batch and per order by the database itself, so the numbers on the planner, tracking and dashboards can't drift apart.

**Turn B — line-side box**
A small installable service that runs at the line, keeps recording when the network drops, syncs when it returns, and resolves conflicts by keeping all entries and flagging overlaps for a supervisor. Station screens point at the local box first, the cloud second.

**Turn C — machine read and command**
Live machine values into the station screens, plus start / stop / setpoint commands. Commands are permission-gated, recorded with the person who issued them, refused while any hold is open, and every line must be enabled for commanding by an admin before any command is accepted. This turn needs your safety sign-off and the list of machines and protocols before I build it.

## Technical plan (Turn A)

**Migration 1 — tenancy**
- `organizations` becomes the tenant root. Add `organization_id` (NOT NULL after backfill) to `products`, `production_orders`, `production_batches`, `product_units`, `unit_events`, `unit_readings`, `waste_events`, `waste_reasons`, `product_station_recipes`, `station_holds`, `downtime_events`, `quality_holds`, `genealogy_records`, `work_orders`, `mes_users`, `audit_entries`; existing rows backfill from `lines.site_id → sites.organization_id`, unattached rows to the current single org.
- `public.user_orgs(_user uuid)` and `public.in_my_org(_org text)` security-definer helpers; every RLS policy on those tables gains `AND public.in_my_org(organization_id)` alongside the existing `has_permission` check. `scope_ancestors` already resolves org, so scoped grants keep working unchanged.
- Shared feeds: `MES_API_KEY` becomes per-tenant (`api_keys` table: hashed key, org, label, active, last_used_at); `api-guard.server.ts` resolves the key to an org and scopes every query to it. Single-key mode stays valid until keys are issued.

**Migration 2 — production mode + lifecycle**
- `lines.tracking_mode text check in ('serial','lot')` default `serial`; `production_orders.tracking_mode`, `production_batches.tracking_mode` inherited at creation.
- New `batch_station_progress` (batch, station, qty_in, qty_good, qty_rework, qty_scrap, opened_at, closed_at, org) for lot lines, append-only corrections through linked rows.
- `status` columns constrained to the allowed sets; `public.assert_status_transition(entity, from, to)` + BEFORE UPDATE triggers on `production_orders` and `production_batches` reject illegal moves.
- `product_station_recipes` gains `is_ccp boolean`, `blocks_on_fail boolean`, `requires_reading boolean`; `stations.sequence` already gives route order — add `lines.enforce_route boolean` default true.
- `recalc_batch_and_order_progress` extended to sum lot progress and scrap, exposing `qty_good`, `qty_scrap`, `qty_rework` on batch and order.

**Server functions**
- `src/lib/mes/execution.functions.ts` — extract the rule checks into `validateStationMove()` (route order, CCP, required readings and limits, holds at unit/batch/order/station level, unit status) used by `recordUnitEvent`; add `recordLotProgress` (lot lines), `sendToRework` (needs `execution.rework`, falls back to `orders.dispatch`), `reopenUnit`.
- `src/lib/mes/orders.functions.ts` (new) — `releaseOrder`, `startBatch`, `pauseBatch`, `finishBatch`, `closeOrder`, `cancelOrder`: each permission-checked, transition-validated, writes an audit entry with the real actor.
- New permission keys: `execution.rework`, `orders.lifecycle`, `machines.command` (reserved for Turn C). Seeded into `role_permissions` for supervisor / planner / process engineer as appropriate.

**Client**
- Planner, production orders, batch and tracking pages get lifecycle buttons gated by `useCan('orders.lifecycle')` and disabled with the reason when a transition isn't allowed.
- `hmi.$stationId.tsx` / `operator.$stationId.tsx` branch on the line's tracking mode: item scan panel, or a lot quantity panel (good / rework / scrap with reason).
- Station screens surface refusals inline with the exact rule that blocked the move.

**Verification before I report done:** a second org's rows must be invisible to a member of the first org through both the app and a keyed feed; an out-of-route scan, a missing CCP reading, an out-of-limit value and a held batch must each be refused with the right message; an illegal order transition must be rejected by the database directly; lot good+rework+scrap must reconcile against batch quantity; existing item-level flows must still pass end to end.
