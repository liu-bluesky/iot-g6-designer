import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

function pathResolve(dir: string) {
  return resolve(process.cwd(), '.', dir);
}

export default defineConfig({
  base: '',
  define: {
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /\/@\//,
        replacement: pathResolve('src') + '/',
      },
      {
        find: /\/@ts\//,
        replacement: pathResolve('src') + '/',
      },
      {
        find: '@',
        replacement: pathResolve('src'),
      },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
});
