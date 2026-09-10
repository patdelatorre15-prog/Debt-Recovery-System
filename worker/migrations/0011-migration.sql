CREATE TABLE IF NOT EXISTS recovery_progress_milestones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percentage INTEGER NOT NULL CHECK (percentage >= 10 AND percentage <= 100 AND percentage % 10 = 0),
  achieved_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, percentage)
);

CREATE INDEX IF NOT EXISTS idx_recovery_progress_milestones_user_date
  ON recovery_progress_milestones(user_id, achieved_on DESC, percentage DESC);
