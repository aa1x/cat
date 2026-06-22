import { getDb, getServerByUid, isValidServer, isValidUid } from './_db.js';
import { cleanupOldAjiReports } from './_aji-reports.js';
import { cleanupOldDailyAji } from './_cleanup.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const db = getDb(env);
    const currentAjiDate = await cleanupOldDailyAji(db);
    const reportCleanup = cleanupOldAjiReports(db).catch((err) => console.warn('阿基喵利举报清理失败', err));
    context.waitUntil?.(reportCleanup);
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET') {
      const server = url.searchParams.get('server');
      if (!isValidServer(server)) {
        return jsonResponse({ message: 'server 参数必须为 官服 或 B服' }, 400);
      }

      const ajiDate = currentAjiDate;
      const row = await db
        .prepare('SELECT uid FROM daily_aji WHERE server = ? AND aji_date = ? ORDER BY created_at DESC, id DESC LIMIT 1')
        .bind(server, ajiDate)
        .first();
      return jsonResponse({ uid: row?.uid || null });
    }

    if (method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ message: '请求体必须是合法 JSON' }, 400);
      }

      const { uid } = body || {};
      const server = getServerByUid(uid);
      if (!isValidUid(uid) || !server) {
        return jsonResponse({ message: '参数无效' }, 400);
      }

      const ajiDate = currentAjiDate;
      try {
        await db
          .prepare('INSERT INTO daily_aji (uid, server, aji_date, created_at) VALUES (?, ?, ?, ?)')
          .bind(uid, server, ajiDate, new Date().toISOString())
          .run();
      } catch (err) {
        return jsonResponse({ message: err?.message || '提交失败' }, 400);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'GET, POST' });
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
