PRAGMA foreign_keys = ON;

ALTER TABLE living_plans ADD COLUMN effective_from TEXT;

UPDATE living_plans
SET effective_from = substr(created_at,1,10)
WHERE effective_from IS NULL;

CREATE INDEX IF NOT EXISTS idx_living_plans_user_effective
ON living_plans(user_id,active,effective_from);
