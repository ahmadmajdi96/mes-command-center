# Production Order Execution + Smarter Lists

Two parts. Part 2 (lists) ships first because it touches every page and is quick to verify; Part 1 is split into three turns because it's large.

## Part 2 — Every list in the system (Turn 1)

One shared list toolbar + table helper used on all list pages (Production Orders, Batches, Work Orders, Products, Units/Tracking, Stations, Lines, Users, Downtime, Quality, Waste reasons, Genealogy, Audit, Traceability, Recipes, Step templates, Assignments, and the new pages below).

- Rows per page: 50, 57, 100, 150, 200, with next/previous and "x–y of N".
- Search box across the key text columns of each list.
- Column filters (status, line, shift, etc. per page).
- Created date/time range picker (from–to, with quick picks: last hour, today, 7 days, 30 days, custom).
- Export the filtered result to CSV and Excel (all matching rows, not just the visible page).
- Filters are kept in the page address so they survive refresh and can be shared.

## Part 1 — Gaps from the Production Order Execution document

Current coverage vs the document:

```text
Covered/partial: orders, products (materials), stations/lines (work centers),
batch numbers, recipes (route steps + instructions), data collection,
scrap with reason, yield (good/rework/scrap), start/complete on stations
Missing: ERP replication, BOMs, routings as own objects, production versions,
execution scenarios, order-specific routing, ERP override, material
consumption, activity confirmation, confirmations, goods receipt
(finished/co/by-products), backflush, packing units, post-production report
```

### Turn 2 — Master data from ERP
- New records: BOMs (components + quantities + backflush flag + co/by-product outputs), Routings (ordered operations, work center, standard times, work instructions), Production Versions (material + BOM + routing + validity), Work Centers view over lines/stations.
- ERP inbound feed per customer key: materials, work centers, BOMs, routings, batch numbers, production versions, production orders (create or update by ERP number). Sync log page showing each message, result and errors.
- "MES override" flag per field group so MES-edited values aren't overwritten by the next ERP sync.

### Turn 3 — Order execution
- On order release: choose execution scenario (production version), then the order gets its own copy of the routing that can be edited without changing master data.
- Operation start / complete per order operation, with status tracking.
- Material consumption per order/batch (manual, plus automatic backflush on confirmation), linked to genealogy.
- Activity confirmation (labor/machine minutes per operation).
- Production confirmation screen combining yield, scrap (with reason), consumption and activities; quantity confirmation vs plan.

### Turn 4 — Goods receipt, packing, reporting
- Goods receipt for finished goods, co-products and by-products (auto on confirmation where configured), with a simple stock-on-hand view.
- Packing units: group items (full or partial quantities) into cartons/boxes with a label.
- Post-production report per order: planned vs actual, scrap, consumption, times; printable and exportable. Outbound feed so ERP can read confirmations and receipts.

## Technical details
- Shared `DataList` hook/component: server-side range pagination via `.range()` with `count: "exact"`, `ilike` OR search, `gte/lte created_at`, URL search via zod `fallback`. Export uses batched fetches (1,000 rows/page) → CSV / `xlsx`.
- New tables all carry `organization_id`, tenant RLS via `in_my_org` + `has_action`, GRANTs, timestamps; confirmations/consumption/receipts append-only with correction links like existing history tables.
- ERP inbound at `/api/mes/v1/erp/*` using existing `authorizeApi` keys, idempotent upserts by ERP id, `erp_sync_log` table.
