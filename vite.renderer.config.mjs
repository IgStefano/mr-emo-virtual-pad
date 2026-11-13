import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const nonce = randomBytes(24).toString('base64');
  return {
    plugins: [
      react(),
      {
        name: 'development-csp',
        transformIndexHtml: {
          order: 'pre',
          handler(html) {
            if (command !== 'serve') {
              return html.replace(
                "connect-src 'self' ws://localhost:* ws://127.0.0.1:*",
                "connect-src 'none'",
              );
            }
            return html
              .replace(
                "script-src 'self'",
                `script-src 'self' 'nonce-${nonce}'`,
              )
              .replace("style-src 'self'", `style-src 'self' 'nonce-${nonce}'`);
          },
        },
      },
    ],
    ...(command === 'serve' ? { html: { cspNonce: nonce } } : {}),
    base: './',
  };
});
