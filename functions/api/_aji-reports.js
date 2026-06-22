import { getShanghaiAjiDate } from './_time.js';

export const AJI_REPORT_REASONS = {
  not_visitable: '未开启可拜访',
  no_aji: '车厢无阿基喵利',
};

const REPORT_DDL = `CREATE TABLE IF NOT EXISTS daily_aji_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  aji_date TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  replacement_uid TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
)`;

const VALID_DDL = `CREATE TABLE IF NOT EXISTS daily_aji_report_valid_uids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  aji_date TEXT NOT NULL,
  report_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (uid, server, aji_date)
)`;

const REPORT_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_daily_aji_reports_status_date ON daily_aji_reports (status, aji_date, id DESC)',
  'CREATE INDEX IF NOT EXISTS idx_daily_aji_reports_uid_date ON daily_aji_reports (uid, server, aji_date)',
  'CREATE INDEX IF NOT EXISTS idx_daily_aji_report_valid_uid_date ON daily_aji_report_valid_uids (uid, server, aji_date)',
];

export async function ensureAjiReportTables(db) {
  await db.prepare(REPORT_DDL).run();
  await db.prepare(VALID_DDL).run();
  for (const sql of REPORT_INDEXES) {
    await db.prepare(sql).run();
  }
}

export async function cleanupOldAjiReports(db, now = new Date()) {
  await ensureAjiReportTables(db);
  const currentAjiDate = getShanghaiAjiDate(now);
  await db.prepare('DELETE FROM daily_aji_reports WHERE aji_date <> ?').bind(currentAjiDate).run();
  await db.prepare('DELETE FROM daily_aji_report_valid_uids WHERE aji_date <> ?').bind(currentAjiDate).run();
  return currentAjiDate;
}

export function getAjiReportReasonText(reasonCode) {
  return AJI_REPORT_REASONS[reasonCode] || '';
}
