import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'demo',
  resolve: {
    alias: {
      'three-ocean': path.resolve(__dirname, 'src/index.ts'),
    },
  },
  server: {
    open: true,
  },
});
