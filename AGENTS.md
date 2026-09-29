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
