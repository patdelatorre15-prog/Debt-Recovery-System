# Cycle 1 Complete Correction

Status: Fix implemented; regression testing still required before launch approval.

This package consolidates the Cycle 1 fixes and approved usability changes. It does not reset D1, delete accounts, or alter the protected tester identity.

## Deployment order

1. Back up the production D1 database.
2. Apply `worker/migrations/0003_cycle1_fixes.sql` to the existing database.
3. Deploy the Worker from `worker/`.
4. Deploy the Pages/static files from the repository root.
5. Run Cycle 1 regression tests using the existing protected test account.

## Included corrections

- Empty loading state replaces the old demo-data flash.
- Income review is a real confirmation step; cancelling it saves nothing.
- Expected income can be edited or cancelled and keeps its selected dates.
- Allocation management lives on Income and valid 100% totals are accepted.
- Cost of Living uses one bulk plan table with type, plan, due day, effective date, and active status.
- Recording the current bill and paying it are separate actions.
- Unlisted expenses are included in Living spending totals.
- Living and debt actions display backend validation failures instead of failing silently.
- Debt monthly paid/unpaid/status values are reconciled with recorded payments.
- Actions provides category coverage, an inline Move Money form, preview, and recent moves.
- Dashboard Needs Attention is generated from live records; View all includes explanations and direct review actions.
- Dashboard forecast clearly shows a 30-day period, expected income, required obligations, and projected surplus/shortfall.
- Recovery requires an explicit journey start; its starting balance is fixed at confirmation.
- Read-only dialogs use Close/X only; action dialogs clear stale notices.
- Account includes Log out.
- Ordinary users do not see the Admin shell while authorization is checked.
- Admin, Living, debt, and modal controls have responsive layouts.
- Account export includes bill instances and omits unnecessary internal identity fields.

## Validation completed

- JavaScript syntax checks passed.
- Automated suite: 23 tests passed, 0 failed.
- Added regression coverage for expected-income editing/cancellation, bulk Cost of Living plans, explicit Recovery start, absence of demo fallbacks, and presence of the corrected UI workflows.

Automated success is not launch approval. Manual desktop, tablet, and mobile regression remains required.
