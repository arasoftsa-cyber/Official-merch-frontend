import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  const { default: react } = await import('@vitejs/plugin-react');
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // Keep runtime env handling in src/config so Vite does not ingest unrelated
    // server-side keys from .env files.
    plugins: [react()],
    define: {
      'globalThis.__APP_RUNTIME_ENV__': JSON.stringify({
        MODE: mode,
        DEV: mode === 'development',
        PROD: mode === 'production',
        VITE_API_BASE_URL: String(env.VITE_API_BASE_URL || '').trim(),
      }),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '::1',
        'officialmerch.tech',
        'www.officialmerch.tech',
      ],
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
