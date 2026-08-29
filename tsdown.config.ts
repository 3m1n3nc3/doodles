import { defineConfig } from 'tsdown'

/**
 * Three outputs from one source tree:
 *
 *   lib/   the published library, file-for-file with src/ so the `exports`
 *          map can keep pointing at real paths, plus .d.ts
 *   lib/bin/  the CLI, bundled so it runs straight off a global install
 *   dist/  the playground, bundled for a static host
 */
export default defineConfig([
  {
    entry: ['src/**/*.ts'],
    outDir: 'lib',
    format: 'esm',
    platform: 'neutral',
    unbundle: true,
    dts: true,
    clean: true,
  },
  {
    entry: ['bin/naives.ts'],
    outDir: 'lib/bin',
    format: 'esm',
    platform: 'node',
    // The package is type: module, so plain .js is already ESM -- and that is
    // what the `bin` field points at.
    outExtensions: () => ({ js: '.js' }),
    dts: false,
    clean: false,
  },
  {
    entry: ['web/app.ts'],
    outDir: 'dist',
    format: 'esm',
    platform: 'browser',
    dts: false,
    clean: true,
  },
])
