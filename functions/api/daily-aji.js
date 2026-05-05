import { getShanghaiDayStart4amUtcIso } from './_time';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const { SUPABASE_URL, SUPABASE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置');
    }

    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET') {
      const server = url.searchParams.get('server');
      if (!server) throw new Error('缺少 server 参数');

      const startUTC = getShanghaiDayStart4amUtcIso();
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_aji?server=eq.${encodeURIComponent(server)}&created_at=gte.${startUTC}&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || '查询 daily_aji 失败');
      }

      const data = await response.json();
      const uid = data?.[0]?.uid || null;
      return new Response(JSON.stringify({ uid }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'POST') {
      const body = await request.json();
      const { uid, server } = body;
      if (!/^\d{9}$/.test(uid) || !server) throw new Error('参数无效');

      const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_aji`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ uid, server }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return new Response(JSON.stringify({ message: err.message, code: err.code }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (err) {
    return new Response(
      JSON.stringify({ message: err.message || '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
