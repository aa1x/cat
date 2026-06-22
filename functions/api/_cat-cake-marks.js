export const CAT_CAKE_MARK_REASONS = {
  not_visitable: '未开启可拜访',
  wrong_location: '地点信息错误',
  wrong_cat_info: '猫猫糕信息错误',
};

const MARK_DDL = `CREATE TABLE IF NOT EXISTS cat_cake_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  week_start TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (uid, server, week_start, reason_code)
)`;

const MARK_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_cat_cake_marks_server_week_uid ON cat_cake_marks (server, week_start, uid)',
];

export async function ensureCatCakeMarkTables(db) {
  await db.prepare(MARK_DDL).run();
  for (const sql of MARK_INDEXES) {
    await db.prepare(sql).run();
  }
}

export async function cleanupOldCatCakeMarks(db, currentWeekStart) {
  await ensureCatCakeMarkTables(db);
  await db.prepare('DELETE FROM cat_cake_marks WHERE week_start <> ?').bind(currentWeekStart).run();
}

export function getCatCakeMarkReasonText(reasonCode) {
  return CAT_CAKE_MARK_REASONS[reasonCode] || '';
}
