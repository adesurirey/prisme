import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// GitHub Pages project site: https://adesurirey.github.io/prisme/
export default defineConfig({
  site: 'https://adesurirey.github.io',
  base: '/prisme',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
