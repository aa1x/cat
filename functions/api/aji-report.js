import { getDb, isValidServer, isValidUid } from './_db.js';
import { cleanupOldDailyAji } from './_cleanup.js';
import { cleanupOldAjiReports, getAjiReportReasonText } from './_aji-reports.js';

const VALID_REASON_CODES = new Set(['not_visitable', 'no_aji']);

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!['GET', 'POST'].includes(request.method)) {
      return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'GET, POST' });
    }

    const db = getDb(env);
    const ajiDate = await cleanupOldDailyAji(db);
    await cleanupOldAjiReports(db);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const uid = url.searchParams.get('uid');
      const server = url.searchParams.get('server');
      if (!isValidUid(uid) || !isValidServer(server)) {
        return jsonResponse({ message: '参数无效' }, 400);
      }
      const validRow = await getValidAjiReportUid(db, uid, server, ajiDate);
      return jsonResponse({
        valid_after_report: Boolean(validRow),
        message: validRow ? '该UID已在被举报后由管理员判定为有效,请勿虚假举报' : '',
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: '请求体必须是合法 JSON' }, 400);
    }

    const { uid, server, reason } = body || {};
    if (!isValidUid(uid) || !isValidServer(server) || !VALID_REASON_CODES.has(reason)) {
      return jsonResponse({ message: '参数无效' }, 400);
    }

    const validRow = await getValidAjiReportUid(db, uid, server, ajiDate);
    if (validRow) {
      return jsonResponse({ message: '该UID已在被举报后由管理员判定为有效,请勿虚假举报', code: 'uid_valid_after_report' }, 409);
    }

    const currentRow = await db
      .prepare('SELECT id, uid FROM daily_aji WHERE server = ? AND aji_date = ? ORDER BY created_at DESC, id DESC LIMIT 1')
      .bind(server, ajiDate)
      .first();
    if (!currentRow?.uid) {
      return jsonResponse({ message: '当前没有可举报的阿基喵利 UID' }, 404);
    }
    if (currentRow.uid !== uid) {
      return jsonResponse({ message: '该 UID 已不是当前展示的阿基喵利' }, 409);
    }

    const existingReport = await db
      .prepare("SELECT id FROM daily_aji_reports WHERE uid = ? AND server = ? AND aji_date = ? AND status = 'pending' LIMIT 1")
      .bind(uid, server, ajiDate)
      .first();
    if (existingReport) {
      await db.prepare('DELETE FROM daily_aji WHERE server = ? AND aji_date = ? AND uid = ?').bind(server, ajiDate, uid).run();
      return jsonResponse({ success: true, hidden: true, report_id: existingReport.id });
    }

    const reasonText = getAjiReportReasonText(reason);
    const insertResult = await db
      .prepare('INSERT INTO daily_aji_reports (uid, server, aji_date, reason_code, reason_text, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uid, server, ajiDate, reason, reasonText, new Date().toISOString())
      .run();

    await db.prepare('DELETE FROM daily_aji WHERE server = ? AND aji_date = ? AND uid = ?').bind(server, ajiDate, uid).run();

    return jsonResponse({ success: true, hidden: true, report_id: insertResult.meta?.last_row_id || null });
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

async function getValidAjiReportUid(db, uid, server, ajiDate) {
  return db
    .prepare('SELECT id FROM daily_aji_report_valid_uids WHERE uid = ? AND server = ? AND aji_date = ? LIMIT 1')
    .bind(uid, server, ajiDate)
    .first();
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
