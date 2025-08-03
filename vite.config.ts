import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(), // Add support for top-level await, useful for WASM modules
  ],
  base: './',
  resolve: {
    alias: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer',
      // Ensure util is polyfilled, as some Node.js modules rely on it
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
    ], // Pre-bundle dependencies to avoid runtime issues
    esbuildOptions: {
      define: {
        global: 'globalThis',
        'process.env': '{}', // Ensure process.env is defined
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
    target: 'esnext', // Ensure modern ES modules for WASM compatibility
    rollupOptions: {
      external: [], // Ensure no dependencies are externalized unexpectedly
    },
  },
});