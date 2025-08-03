import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    {
      name: 'inject-buffer',
      transformIndexHtml: {
        enforce: 'pre',
        transform() {
          return [
            {
              tag: 'script',
              attrs: { type: 'module' },
              children: `
                import { Buffer } from 'buffer';
                window.Buffer = Buffer;
              `,
            },
          ];
        },
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
      util: 'util',
    },
  },
  optimizeDeps: {
    include: [
      'bitcoinjs-lib',
      'tiny-secp256k1',
      'ecpair',
      'bip39',
      'bip32',
      'crypto-browserify',
      'stream-browserify',
      'buffer',
      'util',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
        'process.env': '{}',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true,
        }),
      ],
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: [],
      plugins: [
        // Ensure buffer is correctly resolved in production
        {
          name: 'buffer-polyfill',
          resolveId(id) {
            if (id === 'buffer') {
              return id;
            }
          },
          load(id) {
            if (id === 'buffer') {
              return 'export { Buffer } from "buffer";';
            }
          },
        },
      ],
    },
  },
});