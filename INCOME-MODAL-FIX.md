# Income modal action fix

## Issue

On the Income page, the Receive, Edit, and Cancel dialogs opened, but their internal action buttons did not respond reliably.

## Fix

- Attached the modal Cancel and Close controls directly when a modal is created.
- Attached the modal form submission handler directly to the active form.
- Kept the existing delegated handlers as compatibility coverage for the rest of the interface.
- Added a regression check for the direct modal controls.

## Verification

- JavaScript syntax check passed.
- Full automated test suite passed: 32 of 32 tests.

## Historical allocation correction

- Income breakdowns now use the allocation ledger entries linked to the selected income record.
- Each breakdown retains the percentage and amount applied when that income was received.
- Changing the current allocation percentages affects future income only.
- Local visual-review records also save an allocation snapshot when income is received.

## Expected Income Edit and Cancel API correction

- Edit and Cancel now send both compatible expected-income identifier fields.
- Both Worker entrypoints accept either identifier consistently.
- Expected-status matching is normalized before an update or cancellation.
- Added database-backed production-route tests for editing and cancelling an expected-income plan.
