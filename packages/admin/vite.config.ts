import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    envDir: path.resolve(__dirname, '../..'),
    base: '/admin/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 5174,
    },
  };
});
