import { getDb } from './_db.js';

const ANNOUNCEMENT_DDL = `CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
)`;

const ANNOUNCEMENT_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_announcements_active_published ON announcements (is_active, published_at DESC, id DESC)',
];

const ANNOUNCEMENT_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS trg_announcements_updated_at
   AFTER UPDATE ON announcements
   FOR EACH ROW
   WHEN NEW.updated_at = OLD.updated_at
   BEGIN
     UPDATE announcements SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
   END`,
];

export async function onRequest(context) {
  try {
    const { request, env } = context;

    if (request.method !== 'GET') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'GET' });
    }

    const db = getDb(env);
    await ensureAnnouncementTable(db);

    const row = await db
      .prepare(
        `SELECT id, title, content, published_at, created_at, updated_at
         FROM announcements
         WHERE is_active = 1
         ORDER BY published_at DESC, id DESC
         LIMIT 1`
      )
      .first();

    return jsonResponse(row || null);
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

async function ensureAnnouncementTable(db) {
  await db.prepare(ANNOUNCEMENT_DDL).run();
  for (const sql of ANNOUNCEMENT_INDEXES) {
    await db.prepare(sql).run();
  }
  for (const sql of ANNOUNCEMENT_TRIGGERS) {
    await db.prepare(sql).run();
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
