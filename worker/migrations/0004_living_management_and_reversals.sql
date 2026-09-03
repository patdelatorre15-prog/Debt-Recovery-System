-- Cycle 1 Living Expenses management and auditable reversals.
-- Additive only: no existing financial rows are deleted or reset.

ALTER TABLE living_plans ADD COLUMN frequency TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE living_plans ADD COLUMN due_day_secondary INTEGER;

CREATE TABLE IF NOT EXISTS ledger_reversals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  reversal_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, original_entry_id),
  UNIQUE(reversal_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_reversals_user
ON ledger_reversals(user_id, created_at DESC);
