import { defineConfig } from 'tsup';

// Single-file dual output. esbuild bundles every internal import — including the
// vendored `lib/float.js` helper that FloatingParser requires — into each bundle,
// so the ESM output loads under raw Node ESM, bundlers, and (via the CJS twin)
// CommonJS, with no separate runtime files and no self-reference resolution hacks.
export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        outDir: 'build',
        format: ['cjs', 'esm'],
        target: 'es2020',
        platform: 'node',
        dts: true,
        sourcemap: true,
        clean: true,
        outExtension({ format }) {
            return { js: format === 'cjs' ? '.cjs' : '.mjs' };
        }
    },
    {
        entry: { atomicassets: 'src/index.ts' },
        outDir: 'build',
        format: ['iife'],
        globalName: 'atomicassets',
        target: 'es2020',
        platform: 'browser',
        dts: false,
        sourcemap: false,
        outExtension() {
            return { js: '.global.js' };
        }
    }
]);
