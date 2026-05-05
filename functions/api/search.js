import { getShanghaiWeekStartUtcIso } from './_time.js';

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const { SUPABASE_URL, SUPABASE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置');
    }

    const url = new URL(request.url);
    const server = url.searchParams.get('server');
    if (!server) throw new Error('缺少 server 参数');

    const monday = getShanghaiWeekStartUtcIso();
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cat_cakes?server=eq.${encodeURIComponent(server)}&created_at=gte.${monday}&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || '搜索请求失败');
    }

    const data = await response.json();
    return new Response(JSON.stringify(data || []), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({ message: err.message || '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

