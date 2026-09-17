const API = 'https://helphome-api.lifewealth.workers.dev';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

export async function onRequest(context: any) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const url = new URL(context.request.url);
    const target = API + url.pathname + url.search;

    const headers: Record<string, string> = {};
    const ct = context.request.headers.get('content-type');
    const uid = context.request.headers.get('x-user-id');
    if (ct) headers['content-type'] = ct;
    if (uid) headers['x-user-id'] = uid;

    const init: RequestInit = {
      method: context.request.method,
      headers,
    };
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      init.body = await context.request.text();
    }

    const res = await fetch(target, init);
    const body = await res.text();
    const responseCT = res.headers.get('content-type') || 'application/json';

    return new Response(body, {
      status: res.status,
      headers: {
        'content-type': responseCT,
        ...CORS,
      },
    });
  } catch (e: any) {
    return new Response(`Proxy error: ${e.message}`, { status: 502, headers: CORS });
  }
}