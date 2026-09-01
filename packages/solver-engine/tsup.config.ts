import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts', 'src/pyraminx.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
}));
