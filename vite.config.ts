import { defineConfig } from 'vite';

export default defineConfig({
  base: '/gcrtool/',
  build: {
    outDir: 'dist',
    minify: true
  }
});
