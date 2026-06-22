-- Cloudflare D1 admin delete audit table and indexes.
-- Prefer running sql/cloudflare_d1_schema.sql completely. This file is kept as a focused fallback.

CREATE TABLE IF NOT EXISTS admin_delete_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_table TEXT,
  request_ip TEXT,
  attempt_count INTEGER,
  deleted_count INTEGER,
  deleted_rows TEXT,
  filter_query TEXT,
  target_created_at TEXT,
  day_start_utc TEXT,
  day_end_utc TEXT,
  event_time_utc8 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_delete_audit_action_created
  ON admin_delete_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_delete_audit_password_failed
  ON admin_delete_audit_logs (action, request_ip, id DESC);
