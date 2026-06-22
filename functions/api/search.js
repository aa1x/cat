import { deserializeCatCakeRow, getDb, isValidServer } from './_db.js';
import { cleanupOldCatCakeWeeks } from './_cleanup.js';
import { cleanupOldCatCakeMarks } from './_cat-cake-marks.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const server = url.searchParams.get('server');
    if (!isValidServer(server)) {
      return jsonResponse({ message: 'server 参数必须为 官服 或 B服' }, 400);
    }

    const db = getDb(env);
    const weekStart = await cleanupOldCatCakeWeeks(db);
    await cleanupOldCatCakeMarks(db, weekStart);
    const { results = [] } = await db
      .prepare(
        `SELECT id, uid, server, cat_cakes, cat_locations, created_at, week_start
         FROM cat_cakes
         WHERE server = ? AND week_start = ?
         ORDER BY created_at DESC, id DESC`
      )
      .bind(server, weekStart)
      .all();

    const rows = (results || []).map(deserializeCatCakeRow);
    if (rows.length === 0) {
      return jsonResponse(rows);
    }

    const { results: markRows = [] } = await db
      .prepare(
        `SELECT uid, reason_text
         FROM cat_cake_marks
         WHERE server = ? AND week_start = ?
         ORDER BY created_at ASC, id ASC`
      )
      .bind(server, weekStart)
      .all();

    const markMap = new Map();
    for (const mark of markRows || []) {
      if (!mark?.uid || !mark?.reason_text) continue;
      const reasons = markMap.get(mark.uid) || [];
      if (!reasons.includes(mark.reason_text)) reasons.push(mark.reason_text);
      markMap.set(mark.uid, reasons);
    }

    return jsonResponse(rows.map((row) => ({
      ...row,
      mark_reasons: markMap.get(row.uid) || [],
    })));
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
