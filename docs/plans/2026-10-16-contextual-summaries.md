# Replace repeated statistic cards with contextual summaries

## Phase 1 — simplify both class workspaces
Bookings: remove the four KPI cards. Upcoming/review counts already belong to the lifecycle filters and held money belongs to the wallet widget. Only show next-session context, accumulated hours and pending reviews as compact text when relevant; an empty account gets no statistic strip.
Teaching: replace the four KPI cards with one compact wallet summary and withdrawal link. Retain available/pending amounts without presenting the wallet as teaching revenue. Keep class counts in existing filters. Preserve all amounts, actions and API behavior.

## Phase 2 — verification
Run the full repository gate, inspect VI/EN bookings and teaching at 360/768/1440 px, including empty bookings. Commit implementation separately from plan and record evidence.

## Results
- Removed both four-card KPI grids and their CSS/helpers. Learner summaries only render relevant nonzero context. Teaching wallet labels now describe balances rather than incorrectly implying all available wallet credit is teaching revenue.
- Held learner credits remain in the wallet; the regression test checks the real 60-credit amount there and absence of the duplicate escrow heading.
- `pnpm verify` passed, including 307 web tests and architecture gate (899 modules / 2565 dependencies).
- Chromium checked bookings and teaching in VI/EN at 360/768/1440 px: all 12 cases without horizontal overflow or squeezed SVGs. Desktop screenshots visually inspected, including the empty-bookings state without KPI cards.
