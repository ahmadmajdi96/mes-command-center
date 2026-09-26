# Production Lines navigation and workflow upgrade

## Scope

- Move **Live Shop Floor** directly below **Stations** in the Overview navigation.
- Upgrade the Production Lines list with text search, plant/status/work-order filters, 50/75/100/150/200 page sizes, CSV/Excel export, and matching result counts.
- Make each current work-order reference open its work-order profile when that order exists, with a clear unavailable state otherwise.
- Simplify **New Production Line** to operator-entered setup data only: name, plant, status, and target. Generate the line ID automatically and initialize externally supplied live metrics safely. Keep the existing edit form capable of editing appropriate setup fields.
- Add concise help text beneath every field in the new-line form by extending the shared form field definition without changing unrelated forms.
- Make the line-detail station flow zoomable with reset/fit controls, horizontal navigation, and arrows vertically centered against each complete step column, including parallel/duplicated stations.
- Add search, line-relevant filters, paging, CSV/Excel export, and empty-result states to the station configuration list on each line-detail page.
- Add inline operator assignment management to both the Production Lines list and each line-detail page: choose a station and eligible user, set shift/time window, create an assignment, and remove existing assignments. Changes continue through the existing assignment store and audit trail.

## Technical details

- Reuse the existing list-control/export utilities and assignment actions rather than introducing a second data path.
- Add optional field-level helper text to the shared dialog and use it only for the new-line fields requested here.
- Keep generated IDs in the existing `L-###` sequence and preserve current live values as external-service-owned display data.
- Treat station assignments as the source of line staffing; a line's operator panel aggregates assignments across its stations.
- Verify navigation order, filters/export, work-order links, line creation, zoom behavior, parallel-arrow alignment, and assignment add/remove in the signed-in preview at desktop and narrow widths.