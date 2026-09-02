PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deletion_pending','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL CHECK (source IN ('payhip','paypal','external_admin','test')),
  source_transaction_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('3months','6months','12months','test')),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','expired','suspended','disputed','revoked','activation_needs_attention')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(source, source_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_status ON entitlements(user_id,status,ends_on);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  provider_transaction_id TEXT,
  user_email TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS activation_attempts (
  id TEXT PRIMARY KEY,
  payment_event_id TEXT NOT NULL REFERENCES payment_events(id),
  attempt_number INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success','failed','duplicate_prevented','manual_success')),
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(payment_event_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS allocation_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  living_percentage REAL NOT NULL,
  debt_percentage REAL NOT NULL,
  savings_percentage REAL NOT NULL,
  fun_percentage REAL NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (ABS(living_percentage + debt_percentage + savings_percentage + fun_percentage - 100.0) < 0.001)
);
CREATE INDEX IF NOT EXISTS idx_allocations_user_effective ON allocation_rules(user_id,effective_from DESC);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_on TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  source_entry_id TEXT,
  related_type TEXT,
  related_id TEXT,
  description TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_date ON ledger_entries(user_id,occurred_on DESC,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_related ON ledger_entries(user_id,related_type,related_id);

CREATE TABLE IF NOT EXISTS expected_income (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expected_on TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','received','cancelled')),
  received_ledger_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS living_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('bill','budget')),
  planned_amount_minor INTEGER NOT NULL,
  due_day INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id,name)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('savings','fun')),
  name TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('target','sinking','continuous')),
  target_amount_minor INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goals_user_category ON goals(user_id,category,status);

CREATE TABLE IF NOT EXISTS creditors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id,name)
);

CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creditor_id TEXT NOT NULL REFERENCES creditors(id),
  journey_start_balance_minor INTEGER NOT NULL,
  current_balance_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','paid','archived')),
  created_at TEXT NOT NULL,
  paid_at TEXT,
  archived_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (current_balance_minor >= 0),
  CHECK (status != 'archived' OR current_balance_minor = 0)
);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id,status);

CREATE TABLE IF NOT EXISTS debt_agreement_versions (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  effective_on TEXT NOT NULL,
  payment_amount_minor INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  payment_frequency TEXT NOT NULL,
  interest_mode TEXT NOT NULL CHECK (interest_mode IN ('none','included','percentage','fixed')),
  interest_value REAL NOT NULL DEFAULT 0,
  interest_frequency TEXT CHECK (interest_frequency IN ('daily','weekly','monthly')),
  interest_basis TEXT NOT NULL DEFAULT 'remaining' CHECK (interest_basis IN ('remaining','original')),
  payment_paused INTEGER NOT NULL DEFAULT 0,
  change_reason TEXT NOT NULL CHECK (change_reason IN ('created','agreement','negotiated','correction')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debt_agreement_effective ON debt_agreement_versions(debt_id,effective_on DESC);

CREATE TABLE IF NOT EXISTS recovery_journeys (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  started_on TEXT NOT NULL,
  starting_debt_minor INTEGER NOT NULL,
  target_balance_minor INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  no_new_debt_since TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recovery_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_on TEXT NOT NULL,
  balance_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id,snapshot_on)
);

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT REFERENCES users(id),
  subject_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  related_type TEXT,
  related_id TEXT,
  result TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_subject ON admin_audit(subject_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS support_references (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  minimal_metadata_json TEXT NOT NULL DEFAULT '{}',
  delete_after TEXT
);
