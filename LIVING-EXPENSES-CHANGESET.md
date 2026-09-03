# Living Expenses Change Set

Status: Implemented for regression testing. This is not launch approval.

## Included changes

- Top actions now contain only Add Funds and Record Expense.
- Bills and Monthly Spending each contain their own Manage action.
- Monthly Spending management contains only Name, Monthly Amount, and Status.
- Bills management contains Biller, Amount, Due Day, optional Second Due Day, Frequency, and Status.
- Supported bill frequencies are monthly, twice monthly, weekly, and daily.
- Bill Pay captures editable Payment Date, read-only Planned Amount, Actual Amount, and Paid Amount.
- A zero Paid Amount saves the actual bill without creating a payment ledger entry.
- A non-zero payment that differs from the plan requires settlement confirmation.
- Living activity permits eligible entries to be deleted through an auditable ledger reversal with a required note.
- Original and reversal records remain visible. Duplicate reversals are rejected.
- Linked transfers reverse both entries; allocated income reverses the income and all linked category allocations.
- Bill, fund, spending, and due totals are recalculated from the ledger and bill state.

## Deployment order

1. Back up the production D1 database.
2. Apply `worker/migrations/0004_living_management_and_reversals.sql` to the existing D1 database.
3. Deploy `worker/src/index.js`.
4. Replace the repository-root `script.js`, `api-client.js`, and `styles.css`.
5. Wait for the Worker and Pages deployments to finish, then hard-refresh the browser.
6. Run manual Living Expenses regression tests.

The migration is additive and does not reset existing accounts or financial records.

## Automated validation

- JavaScript syntax checks passed.
- 27 automated tests passed; 0 failed.
- Coverage includes zero-payment bill saves, settlement confirmation, bill-payment reversal, duplicate-reversal prevention, linked transfer reversal, and complete allocation reversal.
