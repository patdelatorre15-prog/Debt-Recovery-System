PRAGMA foreign_keys = ON;

ALTER TABLE payment_events ADD COLUMN processing_error TEXT;
ALTER TABLE payment_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payment_events ADD COLUMN next_retry_at TEXT;
ALTER TABLE payment_events ADD COLUMN normalized_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  purchaser_email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('3months','6months','12months')),
  status TEXT NOT NULL CHECK (status IN ('available','claimed','revoked')),
  claimed_user_id TEXT REFERENCES users(id),
  entitlement_id TEXT REFERENCES entitlements(id),
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  UNIQUE(provider,provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_license_email_status ON license_keys(purchaser_email,status);

CREATE TABLE IF NOT EXISTS admin_access_grants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('3months','6months','12months','test')),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','claimed','cancelled')),
  created_by TEXT NOT NULL REFERENCES users(id),
  claimed_user_id TEXT REFERENCES users(id),
  entitlement_id TEXT REFERENCES entitlements(id),
  created_at TEXT NOT NULL,
  claimed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_grants_email ON admin_access_grants(email,status);

CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical','normal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_due ON notification_queue(status,next_attempt_at,priority);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notification_queue(template_key,recipient_email,next_attempt_at);

CREATE TABLE IF NOT EXISTS account_deletion_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  execute_after TEXT,
  status TEXT NOT NULL CHECK (status IN ('requested','confirmed','completed','cancelled','failed')),
  completed_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS scheduled_interest_charges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  agreement_version_id TEXT NOT NULL REFERENCES debt_agreement_versions(id),
  cycle_on TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  created_at TEXT NOT NULL,
  UNIQUE(debt_id,agreement_version_id,cycle_on)
);
CREATE INDEX IF NOT EXISTS idx_interest_user_cycle ON scheduled_interest_charges(user_id,cycle_on DESC);

CREATE TABLE IF NOT EXISTS debt_payment_operations (
  id TEXT PRIMARY KEY,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  expected_balance_minor INTEGER NOT NULL,
  payment_amount_minor INTEGER NOT NULL,
  ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  created_at TEXT NOT NULL,
  UNIQUE(debt_id,expected_balance_minor)
);

CREATE TABLE IF NOT EXISTS living_bill_instances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES living_plans(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,
  due_on TEXT NOT NULL,
  actual_amount_minor INTEGER NOT NULL CHECK (actual_amount_minor >= 0),
  paid_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  status TEXT NOT NULL CHECK (status IN ('unpaid','partially_paid','paid')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(plan_id,billing_month),
  CHECK (paid_amount_minor <= actual_amount_minor)
);
CREATE INDEX IF NOT EXISTS idx_living_bills_user_due ON living_bill_instances(user_id,status,due_on);

CREATE TABLE IF NOT EXISTS living_bill_payment_operations (
  id TEXT PRIMARY KEY,
  bill_instance_id TEXT NOT NULL REFERENCES living_bill_instances(id) ON DELETE CASCADE,
  expected_paid_minor INTEGER NOT NULL,
  payment_amount_minor INTEGER NOT NULL,
  ledger_entry_id TEXT NOT NULL REFERENCES ledger_entries(id),
  created_at TEXT NOT NULL,
  UNIQUE(bill_instance_id,expected_paid_minor)
);

CREATE INDEX IF NOT EXISTS idx_payment_retry ON payment_events(status,next_retry_at);
