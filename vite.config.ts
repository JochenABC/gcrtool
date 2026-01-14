import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'GcrTool',
      fileName: 'gcrtool',
      formats: ['iife']
    },
    outDir: 'dist',
    minify: true
  }
});
