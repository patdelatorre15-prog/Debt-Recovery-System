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
- Full automated test suite passed: 30 of 30 tests.
