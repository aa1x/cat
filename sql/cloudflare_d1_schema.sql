-- Cloudflare D1 schema for cat cake site.
-- Run this complete file with Wrangler, for example:
-- npx wrangler d1 execute <DB_NAME> --file=sql/cloudflare_d1_schema.sql --remote

CREATE TABLE IF NOT EXISTS cat_cakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  cat_cakes TEXT NOT NULL CHECK (json_valid(cat_cakes) AND json_type(cat_cakes) = 'array' AND json_array_length(cat_cakes) = 3),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  week_start TEXT NOT NULL,
  cat_locations TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(cat_locations) AND json_type(cat_locations) = 'array' AND json_array_length(cat_locations) IN (0, 3)),
  UNIQUE (uid, server, week_start)
);

CREATE INDEX IF NOT EXISTS idx_cat_cakes_server_week_start_created
  ON cat_cakes (server, week_start, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cat_cakes_week_start_uid
  ON cat_cakes (week_start, uid);

CREATE TRIGGER IF NOT EXISTS trg_cat_cakes_names_insert
BEFORE INSERT ON cat_cakes
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM json_each(NEW.cat_cakes)
      WHERE value NOT IN ('垃圾糕', '冰糕', '星辰拿铁', '蜂蜜骰子', '芝麻酥', '游戏糕手', '红豆牛奶', '雪顶椰椰', '花见团子', '盹盹咪', '藤萝饼', '谐乐小猫', '蝶豆花慕斯', '白桃布丁', '薄荷提拉咪', '重力酥', '拉姆之友', '萤绒绒', '纯白的孩子', '捣乱专家', '太卜糍', '幸运点心', '墨镜猫咪', '天使圣代', '蓝莓罐子', '白玉青团', '糯米团')
    ) THEN RAISE(ABORT, 'cat_cakes contains invalid name')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_cat_cakes_names_update
BEFORE UPDATE ON cat_cakes
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM json_each(NEW.cat_cakes)
      WHERE value NOT IN ('垃圾糕', '冰糕', '星辰拿铁', '蜂蜜骰子', '芝麻酥', '游戏糕手', '红豆牛奶', '雪顶椰椰', '花见团子', '盹盹咪', '藤萝饼', '谐乐小猫', '蝶豆花慕斯', '白桃布丁', '薄荷提拉咪', '重力酥', '拉姆之友', '萤绒绒', '纯白的孩子', '捣乱专家', '太卜糍', '幸运点心', '墨镜猫咪', '天使圣代', '蓝莓罐子', '白玉青团', '糯米团')
    ) THEN RAISE(ABORT, 'cat_cakes contains invalid name')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_cat_locations_insert
BEFORE INSERT ON cat_cakes
BEGIN
  SELECT CASE
    WHEN json_array_length(NEW.cat_locations) = 3 AND EXISTS (
      SELECT 1 FROM json_each(NEW.cat_locations)
      WHERE value NOT IN ('猫爬架旁桌上台灯', '吧台上固定电话', '车厢上中部沙发', '留声机旁盆栽', '二楼楼梯旁花坛', '车厢下中部沙发', '帕姆衣架旁椅子')
    ) THEN RAISE(ABORT, 'cat_locations contains invalid location')
    WHEN json_array_length(NEW.cat_locations) = 3 AND (
      SELECT COUNT(DISTINCT value) FROM json_each(NEW.cat_locations)
    ) <> 3 THEN RAISE(ABORT, 'cat_locations must be unique')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_cat_locations_update
BEFORE UPDATE ON cat_cakes
BEGIN
  SELECT CASE
    WHEN json_array_length(NEW.cat_locations) = 3 AND EXISTS (
      SELECT 1 FROM json_each(NEW.cat_locations)
      WHERE value NOT IN ('猫爬架旁桌上台灯', '吧台上固定电话', '车厢上中部沙发', '留声机旁盆栽', '二楼楼梯旁花坛', '车厢下中部沙发', '帕姆衣架旁椅子')
    ) THEN RAISE(ABORT, 'cat_locations contains invalid location')
    WHEN json_array_length(NEW.cat_locations) = 3 AND (
      SELECT COUNT(DISTINCT value) FROM json_each(NEW.cat_locations)
    ) <> 3 THEN RAISE(ABORT, 'cat_locations must be unique')
  END;
END;


CREATE TABLE IF NOT EXISTS cat_cake_marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  week_start TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (uid, server, week_start, reason_code)
);

CREATE INDEX IF NOT EXISTS idx_cat_cake_marks_server_week_uid
  ON cat_cake_marks (server, week_start, uid);

CREATE TABLE IF NOT EXISTS daily_aji (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  aji_date TEXT NOT NULL,
  UNIQUE (server, aji_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_aji_server_date_created
  ON daily_aji (server, aji_date, created_at DESC);


CREATE TABLE IF NOT EXISTS daily_aji_reports (
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
);

CREATE INDEX IF NOT EXISTS idx_daily_aji_reports_status_date
  ON daily_aji_reports (status, aji_date, id DESC);
CREATE INDEX IF NOT EXISTS idx_daily_aji_reports_uid_date
  ON daily_aji_reports (uid, server, aji_date);

CREATE TABLE IF NOT EXISTS daily_aji_report_valid_uids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL CHECK (uid GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
  server TEXT NOT NULL CHECK (server IN ('官服', 'B服')),
  aji_date TEXT NOT NULL,
  report_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (uid, server, aji_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_aji_report_valid_uid_date
  ON daily_aji_report_valid_uids (uid, server, aji_date);

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

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_active_published
  ON announcements (is_active, published_at DESC, id DESC);


CREATE TRIGGER IF NOT EXISTS trg_announcements_updated_at
AFTER UPDATE ON announcements
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE announcements SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
