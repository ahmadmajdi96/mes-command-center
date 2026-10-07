<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Line staffing is derived from active station assignments, so line views aggregate existing assignment records instead of storing a separate line-operator relation.

- Maintenance and QA live in external portals; this app only exchanges events via portal_events (outbox, DB triggers) and the HMAC-signed /api/public/portals/$connectionId endpoint — never build maintenance/QA workflows here.
- WIP split/merge/move are SECURITY DEFINER RPCs with in-function permission checks; material lot deduction happens in the consume_from_lot trigger so every consumption path enforces lot limits.
- Phase B quality rules live in the database: skill blocking (guard_operator_skills trigger), NC creation + routing-rule effects (inspection_after_insert trigger), product skip rules on release; step requirements match by step name (+ optional product) so no copying into order steps is needed.
- Detail pages for simple lists use one config-driven route (/record/$kind/$id, config in src/lib/record-kinds.ts) — why: one consistent detail view with back arrow, related records and history instead of 15 near-identical pages.
- Search palette (Ctrl+K) queries each table via the browser client so results respect RLS; notifications are created only by DB triggers via notify_users/notify_user (execute revoked from clients) — why: alerts can't be forged and never block production writes.
- SECURITY DEFINER helpers (permission checks, WIP move/split/merge) live in the non-exposed `private` schema with same-name SECURITY INVOKER wrappers in public — why: keeps them off the public API (linter 0029) while policies and rpc calls stay unchanged.
- Sign-in goes through the signInWithLockout server function (counts failures in auth_login_attempts, service-role only) — why: lockout can't be bypassed from the browser.
- Active BOMs/routings are locked by DB triggers for signed-in users; changes go through new_master_version() drafts and activation needs recipes.publish — why: change control without blocking ERP sync (service role bypasses).
- Overdue approvals and missing downtime reasons are flagged in the UI from timestamps; an hourly pg_cron job (run_reminders) sends the alerts — why: cheap backstop instead of frequent polling.
