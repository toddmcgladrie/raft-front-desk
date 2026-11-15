import { defineConfig, loadEnv } from 'vite';

function isPublishable(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
  } catch {
    return false;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if ((key || process.env.CI) && (!url?.startsWith('https://') || !key || !isPublishable(key))) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the HTTPS project URL and its publishable or legacy anon key.');
  }
  return { base: './' };
});
