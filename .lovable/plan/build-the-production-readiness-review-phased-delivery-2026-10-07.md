# Build the Production Readiness Review — phased delivery

The review has about 80 items. Some can't be finished until you send things. The rest get built in 5 waves. Each wave is tested in the browser, signed in as demo@manuqube.com, before the next one starts.

## Needs something from you (can't be finished without it)
- Real machine list, how each one connects, and a safety sign-off for each machine
- ERP connection details and a sync schedule
- A dedicated test account, so all 57 automated checks can run
- Your call on the demo data: delete it, or keep it

## Wave 1 — Go-live must-haves (P0)
- Security: idle auto sign-out on shared screens, sign-in lockout after repeated failed attempts, stronger password rules, a working forgot-password flow, and no demo login hint on the sign-in page
- Change control: editing an active BOM, routing or work instruction creates a new version that needs approval; master data that is still in use can't be deleted (the page shows where it is used)
- Lots: expired lots are blocked, the oldest-expiring lot is suggested first, and a one-click recall report shows where a lot came from and where it went
- Downtime: a reason is required within a set number of minutes, chosen from a category → reason list
- Approvals: escalation when a request waits longer than a set time; each signature shows what it means (Reviewed / Approved / Released)
- Orders: cancel or close with a reason, and a visible release checklist
- Integration Health page: last success, failures and a retry button for ERP, QA and maintenance; API key expiry dates and reminders
- Admin activity log for changes to roles and permissions
- Check that work-in-progress move, split and merge still work

## Wave 2 — Floor and planning (P0/P1)
- Badge or PIN quick switch between operators on shared stations; large-font, high-contrast floor mode
- Andon "call for help" button; photos attached to holds, waste and quality records
- Capacity planning uses real shift plans and planned downtime; conflict checks for machines or tools that are out of service or on hold
- Changeover times between products; an auto-schedule suggestion

## Wave 3 — Quality and inventory (P1)
- Sampling frequency enforced, with overdue alerts; control charts (SPC); certificate of analysis per lot
- Label printing for lots and work in progress; cycle count scheduling
- Scrap limits set per product and step; waste cost

## Wave 4 — People, alerts, reports (P1)
- Expiry reminders for skills, calibration and certificates; shift swaps and absences
- Approval delegation; quiet hours and escalation chains for alerts; email delivery for critical alerts
- Scheduled daily and shift reports by email; a full audit viewer
- OEE targets per line, saved dashboard views, shift handover summary, hourly board

## Wave 5 — Roadmap (P2)
- TV wall-board mode, what-if planning, order templates, Excel import, units of measure with conversions, plant onboarding wizard

## Technical notes
- Schema changes go through migrations: version tables with approval status, a downtime reason tree, sign-in attempt tracking, integration health records, settings for escalation times and limits
- Scheduled reminders, escalation and emails run from server routes on a timer, and need the email domain set up
- Validation rules live in the database (triggers), matching how the app already works
