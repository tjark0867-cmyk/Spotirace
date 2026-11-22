import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // .env aus dem Projektordner lesen, damit der Proxy denselben Port wie der Server nutzt
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = Number(env.PORT || 3001);

  return {
    root: 'client',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      // erlaubt Freunden im selben WLAN, über deine IP mitzuspielen
      host: true,
      proxy: {
        '/api': `http://127.0.0.1:${serverPort}`,
        '/demo': `http://127.0.0.1:${serverPort}`,
        '/ws': { target: `ws://127.0.0.1:${serverPort}`, ws: true },
      },
    },
  };
});
