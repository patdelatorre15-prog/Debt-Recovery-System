CREATE TABLE IF NOT EXISTS goal_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL UNIQUE REFERENCES goals(id) ON DELETE CASCADE,
  achieved_amount_minor INTEGER NOT NULL,
  achieved_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_achievements_user_date
ON goal_achievements(user_id, achieved_on DESC);
