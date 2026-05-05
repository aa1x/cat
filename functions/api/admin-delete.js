import { getShanghaiDayStart4amUtcIso, getShanghaiLastWeekStartUtcIso } from './_time.js';

const ACTIONS = new Set(['delete_uid', 'delete_last_week', 'delete_aji']);

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const { SUPABASE_URL, SUPABASE_KEY, ADMIN_PASSWORD, ADMIN_ALLOWED_ORIGIN } = env;

    if (request.method !== 'POST') {
      return jsonResponse({ message: 'Method Not Allowed' }, 405, { Allow: 'POST' });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY || !ADMIN_PASSWORD) {
      return jsonResponse({ message: '服务端环境变量未配置完整' }, 500);
    }

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

    if (!safePasswordEqual(password, ADMIN_PASSWORD)) {
      return jsonResponse({ message: '密码错误' }, 401);
    }

    if (action === 'delete_uid') {
      if (typeof uid !== 'string' || !/^\d{9}$/.test(uid)) {
        return jsonResponse({ message: 'UID 必须为 9 位数字' }, 400);
      }
      const result = await deleteFromSupabase(SUPABASE_URL, SUPABASE_KEY, 'cat_cakes', `uid=eq.${uid}`);
      return jsonResponse({ success: true, action, deleted: result.deleted, uid });
    }

    if (action === 'delete_last_week') {
      const lastWeekStartUtcIso = getShanghaiLastWeekStartUtcIso();
      const encodedTime = encodeURIComponent(lastWeekStartUtcIso);
      const result = await deleteFromSupabase(SUPABASE_URL, SUPABASE_KEY, 'cat_cakes', `created_at=eq.${encodedTime}`);
      return jsonResponse({ success: true, action, deleted: result.deleted, target_created_at: lastWeekStartUtcIso });
    }

    const dayStartUtcIso = getShanghaiDayStart4amUtcIso();
    const nextDayUtcIso = new Date(new Date(dayStartUtcIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const result = await deleteFromSupabase(
      SUPABASE_URL,
      SUPABASE_KEY,
      'daily_aji',
      `created_at=gte.${encodeURIComponent(dayStartUtcIso)}&created_at=lt.${encodeURIComponent(nextDayUtcIso)}`
    );
    return jsonResponse({ success: true, action, deleted: result.deleted });
  } catch (err) {
    return jsonResponse({ message: err?.message || '服务器内部错误' }, 500);
  }
}

function safePasswordEqual(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(input);
  const b = encoder.encode(expected);
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i += 1) {
    const av = i < a.length ? a[i] : 0;
    const bv = i < b.length ? b[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

async function deleteFromSupabase(baseUrl, key, table, query) {
  const suffix = query ? `?${query}` : '';
  const response = await fetch(`${baseUrl}/rest/v1/${table}${suffix}`, {
    method: 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `删除失败: ${table}`);
  }

  const countHeader = response.headers.get('content-range');
  const deleted = parseDeletedCount(countHeader);
  return { deleted };
}

function parseDeletedCount(contentRange) {
  if (!contentRange) return null;
  const match = contentRange.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
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
