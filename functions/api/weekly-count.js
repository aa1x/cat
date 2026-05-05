import { getShanghaiWeekStartUtcIso } from './_time.js';

export async function onRequest(context) {
  try {
    const { SUPABASE_URL, SUPABASE_KEY } = context.env;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error('环境变量 SUPABASE_URL 或 SUPABASE_KEY 未设置');
    }

    const monday = getShanghaiWeekStartUtcIso();
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cat_cakes?select=uid&created_at=gte.${monday}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Supabase 查询失败');
    }

    const data = await response.json();
    const uniqueUids = new Set(data.map(r => r.uid));

    return new Response(JSON.stringify({ count: uniqueUids.size }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ message: err.message || '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

