import { getShanghaiWeekStartUtcIso } from './_time.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const { SUPABASE_URL, SUPABASE_KEY } = env;

    if (request.method !== 'POST') {
      return jsonResponse(
        { message: 'Method Not Allowed' },
        405,
        { Allow: 'POST' }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: '请求体必须是合法 JSON' }, 400);
    }

    const { uid, server, cat_cakes, cat_locations } = body || {};

    const isUidValid = typeof uid === 'string' && /^\d{9}$/.test(uid);
    const isServerValid = typeof server === 'string' && server.length > 0;
    const isCatCakesValid = Array.isArray(cat_cakes) && cat_cakes.length === 3 && cat_cakes.every((c) => typeof c === 'string' && c.length > 0);
    const isCatLocationsValid =
      Array.isArray(cat_locations) &&
      (cat_locations.length === 0 || (cat_locations.length === 3 && cat_locations.every((l) => typeof l === 'string' && l.length > 0)));

    if (!isUidValid || !isServerValid || !isCatCakesValid || !isCatLocationsValid) {
      return jsonResponse({ message: '参数无效' }, 400);
    }

    const created_at = getShanghaiWeekStartUtcIso();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cat_cakes`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ uid, server, cat_cakes, cat_locations, created_at }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return jsonResponse(
        { message: err.message || '提交失败', ...(err.code ? { code: err.code } : {}) },
        400
      );
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
