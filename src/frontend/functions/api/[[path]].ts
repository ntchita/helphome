const API = 'https://helphome-demo.lifewealth.workers.dev';

export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  const target = API + url.pathname + url.search;
  return fetch(new Request(target, context.request));
}