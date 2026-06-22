import { deserializeCatCakeRow, getDb, isValidUid } from './_db.js';
import { getShanghaiAjiDate } from './_time.js';

const ACTIONS = new Set(['delete_uid', 'delete_aji']);
const failedPasswordAttemptsByIp = new Map();

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const requestRateByIp = new Map();

const AUDIT_DDL = `CREATE TABLE IF NOT EXISTS admin_delete_audit_logs (
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
)`;

const AUDIT_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_admin_delete_audit_action_created ON admin_delete_audit_logs (action, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_admin_delete_audit_password_failed ON admin_delete_audit_logs (action, request_ip, id DESC)',
];

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const { ADMIN_PASSWORD, ADMIN_ALLOWED_ORIGIN } = env;

    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'POST' });
    }

    if (!ADMIN_PASSWORD) {
      return jsonResponse({ message: '服务端环境变量 ADMIN_PASSWORD 未配置' }, 500);
    }

    const db = getDb(env);
    await ensureAuditTable(db);

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return jsonResponse({ message: 'Content-Type 必须为 application/json' }, 415);
    }

    if (ADMIN_ALLOWED_ORIGIN) {
      const origin = request.headers.get('origin') || '';
      if (origin !== ADMIN_ALLOWED_ORIGIN) {
        return jsonResponse({ message: 'Origin 不被允许' }, 403);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: '请求体必须是合法 JSON' }, 400);
    }

    const { action, uid, password } = body || {};
    if (!ACTIONS.has(action)) {
      return jsonResponse({ message: 'action 不被允许' }, 400);
    }

    const clientIp = getClientIp(request);
    const rateLimitState = checkAndTrackRateLimit(clientIp);
    if (!rateLimitState.allowed) {
      return jsonResponse({ message: '请求过于频繁，请稍后再试', retry_after_seconds: rateLimitState.retryAfterSeconds }, 429);
    }

    if (!safePasswordEqual(password, ADMIN_PASSWORD)) {
      const attempts = await incrementPasswordFailedAttempts(db, clientIp, failedPasswordAttemptsByIp);
      await tryWritePasswordFailedLog(db, clientIp, attempts);
      console.warn('[admin-delete] 密码错误', { ip: clientIp, attempts, action, timestampUtc8: getUtc8Timestamp() });
      return jsonResponse({ message: '密码错误', attempts }, 401);
    }

    if (action === 'delete_uid') {
      if (!isValidUid(uid)) {
        return jsonResponse({ message: 'UID 必须为 9 位数字' }, 400);
      }
      const result = await selectAndDelete(
        db,
        'cat_cakes',
        'SELECT id, uid, server, cat_cakes, cat_locations, created_at, week_start FROM cat_cakes WHERE uid = ? ORDER BY created_at DESC, id DESC',
        'DELETE FROM cat_cakes WHERE uid = ?',
        [uid],
        deserializeCatCakeRow
      );
      const query = 'uid = ?';
      const audit = await logDeleteAction(db, action, clientIp, { table: 'cat_cakes', query, deleted: result.deleted, deletedRows: result.deletedRows });
      return jsonResponse({ success: true, action, deleted: result.deleted, uid, audit_logged: audit.ok });
    }


    const ajiDate = getShanghaiAjiDate();
    const result = await selectAndDelete(
      db,
      'daily_aji',
      'SELECT id, uid, server, aji_date, created_at FROM daily_aji WHERE aji_date = ? ORDER BY created_at DESC, id DESC',
      'DELETE FROM daily_aji WHERE aji_date = ?',
      [ajiDate]
    );
    const audit = await logDeleteAction(db, action, clientIp, {
      table: 'daily_aji',
      query: 'aji_date = ?',
      deleted: result.deleted,
      deletedRows: result.deletedRows,
      dayStartUtcIso: ajiDate,
    });
    return jsonResponse({ success: true, action, deleted: result.deleted, aji_date: ajiDate, audit_logged: audit.ok });
  } catch (err) {
    return jsonResponse({ message: err?.message || '服务器内部错误' }, 500);
  }
}

async function ensureAuditTable(db) {
  await db.prepare(AUDIT_DDL).run();
  for (const sql of AUDIT_INDEXES) {
    await db.prepare(sql).run();
  }
}

async function selectAndDelete(db, table, selectSql, deleteSql, args, rowMapper = (row) => row) {
  const selected = await db.prepare(selectSql).bind(...args).all();
  const deletedRows = (selected.results || []).map(rowMapper);
  const deleted = deletedRows.length;
  await db.prepare(deleteSql).bind(...args).run();
  return { table, deleted, deletedRows };
}

function checkAndTrackRateLimit(ip) {
  const now = Date.now();
  const record = requestRateByIp.get(ip);
  if (!record || now >= record.resetAt) {
    requestRateByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)) };
  }
  record.count += 1;
  requestRateByIp.set(ip, record);
  return { allowed: true, retryAfterSeconds: 0 };
}

function safePasswordEqual(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(input);
  const b = encoder.encode(expected);
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (i < a.length ? a[i] : 0) ^ (i < b.length ? b[i] : 0);
  }
  return diff === 0;
}

function getUtc8IsoTimestamp() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

function getUtc8Timestamp() {
  const utc8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${utc8.toISOString().replace('T', ' ').slice(0, 19)} UTC+8`;
}

function getClientIp(request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) return 'unknown';
  return forwarded.split(',')[0].trim() || 'unknown';
}

async function incrementPasswordFailedAttempts(db, ip, cacheMap) {
  const cachedAttempts = cacheMap.get(ip);
  const remote = await getLatestPasswordFailedRecord(db, ip);
  const remoteAttempts = remote?.attemptCount || 0;
  const attempts = Math.max(cachedAttempts || 0, remoteAttempts) + 1;
  cacheMap.set(ip, attempts);
  return attempts;
}

async function getLatestPasswordFailedRecord(db, ip) {
  const row = await db
    .prepare("SELECT id, attempt_count FROM admin_delete_audit_logs WHERE action = 'password_failed' AND request_ip = ? ORDER BY id DESC LIMIT 1")
    .bind(ip)
    .first();
  if (!row) return null;
  const attemptCount = Number(row.attempt_count);
  return { id: row.id, attemptCount: Number.isFinite(attemptCount) ? attemptCount : 0 };
}

async function tryWritePasswordFailedLog(db, ip, attempts) {
  try {
    const record = await getLatestPasswordFailedRecord(db, ip);
    if (record?.id) {
      await db
        .prepare('UPDATE admin_delete_audit_logs SET attempt_count = ?, event_time_utc8 = ? WHERE id = ?')
        .bind(attempts, getUtc8IsoTimestamp(), record.id)
        .run();
      return { ok: true };
    }
    await writeAuditLog(db, {
      action: 'password_failed',
      request_ip: ip,
      attempt_count: attempts,
      event_time_utc8: getUtc8IsoTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    console.error('[admin-delete] 密码错误日志写入失败', { scene: 'password_failed', message: err?.message || String(err), timestampUtc8: getUtc8Timestamp() });
    return { ok: false, error: err?.message || '写入密码错误日志失败' };
  }
}

async function writeAuditLog(db, payload) {
  await db
    .prepare(
      `INSERT INTO admin_delete_audit_logs
       (action, target_table, request_ip, attempt_count, deleted_count, deleted_rows, filter_query, target_created_at, day_start_utc, day_end_utc, event_time_utc8)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      payload.action,
      payload.target_table || null,
      payload.request_ip || null,
      payload.attempt_count ?? null,
      payload.deleted_count ?? null,
      JSON.stringify(payload.deleted_rows || []),
      payload.filter_query || null,
      payload.target_created_at || null,
      payload.day_start_utc || null,
      payload.day_end_utc || null,
      payload.event_time_utc8 || getUtc8IsoTimestamp()
    )
    .run();
}

async function logDeleteAction(db, action, ip, details) {
  const payload = {
    action,
    target_table: details.table || null,
    request_ip: ip,
    deleted_count: typeof details.deleted === 'number' ? details.deleted : null,
    deleted_rows: details.deletedRows || [],
    filter_query: details.query || null,
    target_created_at: details.target_created_at || null,
    day_start_utc: details.dayStartUtcIso || null,
    day_end_utc: details.nextDayUtcIso || null,
    event_time_utc8: getUtc8IsoTimestamp(),
  };
  const result = await tryWriteAuditLog(db, payload, action);
  console.info('[admin-delete] 管理删除操作日志', { action, ip, timestampUtc8: getUtc8Timestamp(), ...details });
  return result;
}

async function tryWriteAuditLog(db, payload, scene) {
  try {
    await writeAuditLog(db, payload);
    return { ok: true };
  } catch (err) {
    console.error('[admin-delete] 审计日志写入失败', { scene, message: err?.message || String(err), timestampUtc8: getUtc8Timestamp() });
    return { ok: false, error: err?.message || '写入审计日志失败' };
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
