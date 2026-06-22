import { getDb } from './_db.js';
import { cleanupOldCatCakeWeeks } from './_cleanup.js';

export async function onRequest(context) {
  try {
    const db = getDb(context.env);
    const weekStart = await cleanupOldCatCakeWeeks(db);
    const { results = [] } = await db
      .prepare('SELECT COUNT(DISTINCT uid) AS count FROM cat_cakes WHERE week_start = ?')
      .bind(weekStart)
      .all();
    const count = Number(results?.[0]?.count || 0);

    return jsonResponse({ count });
  } catch (err) {
    return jsonResponse({ message: err.message || '服务器内部错误' }, 500);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
