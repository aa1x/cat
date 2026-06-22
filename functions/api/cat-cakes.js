import { getDb, getServerByUid, isValidUid, validateCatCakes, validateCatLocations, encodeJson } from './_db.js';
import { cleanupOldCatCakeWeeks } from './_cleanup.js';

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

    const { uid, cat_cakes, cat_locations = [] } = body || {};
    const server = getServerByUid(uid);

    if (!isValidUid(uid) || !server || !validateCatCakes(cat_cakes) || !validateCatLocations(cat_locations)) {
      return jsonResponse({ message: '参数无效' }, 400);
    }

    const db = getDb(env);
    const createdAt = new Date().toISOString();
    const weekStart = await cleanupOldCatCakeWeeks(db);

    try {
      await db
        .prepare(
          `INSERT INTO cat_cakes (uid, server, cat_cakes, cat_locations, created_at, week_start)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(uid, server, encodeJson(cat_cakes), encodeJson(cat_locations), createdAt, weekStart)
        .run();
    } catch (err) {
      return jsonResponse({ message: err?.message || '提交失败' }, 400);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}
