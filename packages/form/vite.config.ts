import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, '../..'),
    build: {
      outDir: 'dist',
      // Keep hashed bundles out of dist/assets, which holds the marketing site's public images.
      assetsDir: 'static',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
    },
  };
});
