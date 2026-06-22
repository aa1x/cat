import { getDb, isValidServer, isValidUid } from './_db.js';
import { cleanupOldCatCakeWeeks } from './_cleanup.js';
import { cleanupOldCatCakeMarks, getCatCakeMarkReasonText } from './_cat-cake-marks.js';

const VALID_REASON_CODES = new Set(['not_visitable', 'wrong_location', 'wrong_cat_info']);

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'POST' });
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

    const db = getDb(env);
    const weekStart = await cleanupOldCatCakeWeeks(db);
    await cleanupOldCatCakeMarks(db, weekStart);

    const currentRow = await db
      .prepare('SELECT id FROM cat_cakes WHERE uid = ? AND server = ? AND week_start = ? LIMIT 1')
      .bind(uid, server, weekStart)
      .first();
    if (!currentRow) {
      return jsonResponse({ message: '该 UID 已不是本周搜索结果' }, 404);
    }

    const reasonText = getCatCakeMarkReasonText(reason);
    const insertResult = await db
      .prepare('INSERT OR IGNORE INTO cat_cake_marks (uid, server, week_start, reason_code, reason_text, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(uid, server, weekStart, reason, reasonText, new Date().toISOString())
      .run();

    return jsonResponse({ success: true, mark_id: insertResult.meta?.last_row_id || null });
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
