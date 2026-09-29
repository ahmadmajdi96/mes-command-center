# Execution roadmap: validate, then Phases A–C

This is a large amount of work, so it is split into four deliveries. Each one is built, tested in the browser with a real test order, and reported back to you before the next one starts.

## 0. Re-validate "Most Important"
- Run a new test order from start to finish in the browser: release check, start/setup, pause/resume, exception raise/resolve, partial and final quantities (accepted/rejected/scrap), approval step, order hold/release, required completion fields, timeline and final report.
- Confirm on screen that the corrected report only counts what leaves the last step, and fix anything that fails.

## Maintenance and QA portals (applies to every phase)
- Maintenance and QA are **not** built here. This system only sends and receives events:
  - Outgoing: equipment fault, tool due, inspection requested, nonconformance raised, hold placed.
  - Incoming: work order closed, inspection result (pass/fail), nonconformance decision (use as is / rework / scrap), hold released.
- New "Integrations" page: portal endpoints, keys, event log and retry.
- Incoming results unblock or hold steps and batches automatically.

## Phase A — WIP and materials
- WIP locations (buffers, staging areas), move WIP between them.
- Split and merge batches, with parent/child traceability.
- WIP aging (time at location, alert thresholds) and reconciliation (expected vs counted, adjustment with reason).
- Material lots: receive lots, scan the lot consumed at a step, record actual quantities vs planned, lot genealogy (which raw lots went into which finished lots).
- Semi-finished goods: intermediate products produced at one step and consumed at a later step or order.
- Rework tasks: created from rejects, assigned, done, then sent for re-inspection (from the QA portal or locally recorded result).

## Phase B — Routing, quality handoff, skills
- Dynamic routing rules (for example: if the result is out of range, go to a rework step; skip a step for a certain product).
- Inspection plans per step (what to check, sampling frequency), results recorded or received from QA.
- Nonconformance records created here and sent to QA; decision comes back.
- Operator skills and certifications with expiry; unqualified operators are blocked from starting a step.

## Phase C — Instructions, sign-off, equipment
- Step-by-step work instructions with images, checklists and required inputs.
- Configurable approval workflows (who must approve what).
- Electronic signatures: re-enter password plus reason, stored in history.
- Tools: tool list, usage counts and calibration due; due items go to the Maintenance portal.
- Shift plans saved in the database, so they are shared across devices.
- Machine connection layer: the edge box connection and data mapping, ready for real machines. Live drivers still require your machine list and safety sign-off.

## Testing for each phase
- Automated backend tests for the new rules: company separation, permissions and blocking.
- A browser run of the main flow with real input, with screenshots checked.
- Search, date filter, page size (50/75/100/150/200) and export on every new list; every row opens a detail page with a back arrow.

## Technical notes
- New tables use company-scoped access rules and append-only history, following current patterns.
- Portal exchange: signed incoming requests under the public API area, plus an outgoing queue with retries.
