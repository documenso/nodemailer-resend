import { defineConfig } from 'tsup';

export default defineConfig({
  dts: true,
  treeshake: true,
  sourceMap: true,
  minify: false,
  format: ['esm', 'cjs'],
  entry: ['src/main.ts'],
});
