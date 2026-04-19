import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://marketus.ai',
  output: 'static',
  adapter: vercel(),
  trailingSlash: 'ignore',
});
