import { serve } from '@hono/node-server';
import app from './src/api/index.ts';

console.log('🚀 Helphome API running on http://localhost:8787');

serve({
  fetch: app.fetch,
  port: 8787,
});