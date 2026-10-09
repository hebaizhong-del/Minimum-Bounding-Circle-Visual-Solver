import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: false
  },
  plugins: [
    {
      name: 'remove-vite-client',
      transformIndexHtml(html) {
        return html.replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '');
      }
    }
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: true
  }
});
