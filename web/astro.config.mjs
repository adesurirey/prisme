import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Custom domain: https://leprisme.info/
export default defineConfig({
  site: 'https://leprisme.info',
  base: '/',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
