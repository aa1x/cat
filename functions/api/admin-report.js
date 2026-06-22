import { getDb, isValidUid } from './_db.js';
import { cleanupOldDailyAji } from './_cleanup.js';
import { cleanupOldAjiReports } from './_aji-reports.js';

const ACTIONS = new Set(['list', 'resolve']);
const RESOLUTIONS = new Set(['accepted', 'rejected']);

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

    const { action, password } = body || {};
    if (!ACTIONS.has(action)) {
      return jsonResponse({ message: 'action 不被允许' }, 400);
    }
    if (!safePasswordEqual(password, ADMIN_PASSWORD)) {
      return jsonResponse({ message: '密码错误' }, 401);
    }

    const db = getDb(env);
    const ajiDate = await cleanupOldDailyAji(db);
    await cleanupOldAjiReports(db);

    if (action === 'list') {
      const { results = [] } = await db
        .prepare("SELECT id, uid, server, aji_date, reason_code, reason_text, status, replacement_uid, created_at, resolved_at FROM daily_aji_reports WHERE aji_date = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, id DESC")
        .bind(ajiDate)
        .all();
      return jsonResponse({ reports: results || [], aji_date: ajiDate });
    }

    const reportId = Number(body.report_id);
    const resolution = body.resolution;
    if (!Number.isInteger(reportId) || reportId <= 0 || !RESOLUTIONS.has(resolution)) {
      return jsonResponse({ message: '参数无效' }, 400);
    }

    const report = await db
      .prepare('SELECT id, uid, server, aji_date, status FROM daily_aji_reports WHERE id = ? LIMIT 1')
      .bind(reportId)
      .first();
    if (!report) {
      return jsonResponse({ message: '举报不存在' }, 404);
    }
    if (report.aji_date !== ajiDate) {
      return jsonResponse({ message: '只能处理今日阿基喵利举报' }, 400);
    }
    if (report.status !== 'pending') {
      return jsonResponse({ message: '该举报已处理' }, 409);
    }

    const currentRow = await db
      .prepare('SELECT uid FROM daily_aji WHERE server = ? AND aji_date = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .bind(report.server, report.aji_date)
      .first();
    let replacementUid = currentRow?.uid || null;
    if (replacementUid === report.uid) {
      replacementUid = null;
    }

    if (resolution === 'accepted') {
      await db.prepare('DELETE FROM daily_aji WHERE server = ? AND aji_date = ? AND uid = ?').bind(report.server, report.aji_date, report.uid).run();
    }

    if (resolution === 'rejected') {
      if (!isValidUid(report.uid)) {
        return jsonResponse({ message: '举报 UID 无效' }, 400);
      }
      await db.prepare('DELETE FROM daily_aji WHERE server = ? AND aji_date = ?').bind(report.server, report.aji_date).run();
      await db
        .prepare('INSERT INTO daily_aji (uid, server, aji_date, created_at) VALUES (?, ?, ?, ?)')
        .bind(report.uid, report.server, report.aji_date, new Date().toISOString())
        .run();
      await db
        .prepare('INSERT OR REPLACE INTO daily_aji_report_valid_uids (uid, server, aji_date, report_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(report.uid, report.server, report.aji_date, report.id, new Date().toISOString())
        .run();
    }

    await db
      .prepare('UPDATE daily_aji_reports SET status = ?, replacement_uid = ?, resolved_at = ? WHERE id = ?')
      .bind(resolution, replacementUid, new Date().toISOString(), report.id)
      .run();

    return jsonResponse({ success: true, report_id: report.id, status: resolution, restored_uid: resolution === 'rejected' ? report.uid : null, replaced_uid: replacementUid });
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

function safePasswordEqual(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  if (input.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
