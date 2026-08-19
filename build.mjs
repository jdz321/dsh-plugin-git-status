#!/usr/bin/env node
/**
 * Build the plugin package with locally installed dependencies only:
 *   1. host half  — `node_modules/typescript/bin/tsc` → lib/index.js + lib/*.d.ts
 *                  (Node ESM, imported by the Loader as a normal cordis.yml row).
 *   2. client half — `node_modules/esbuild/bin/esbuild` → lib/client.js (browser
 *                  bundle in the DSH web ModuleLoader factory format).
 *
 * Run `npm install` first — every tool and type dependency is a devDependency
 * resolved through the registry.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// tsc is a JS entry (run with node); esbuild's bin is a platform-native
// binary (run directly).
const requireModule = (relative) => join(here, 'node_modules', relative)
const modules = {
  typescript: requireModule('typescript/bin/tsc'),
  esbuild: requireModule('esbuild/bin/esbuild'),
}

for (const [name, path] of Object.entries(modules)) {
  if (!existsSync(path)) {
    console.error(`build: missing ${name} at ${path} — run \`npm install\` first`)
    process.exit(1)
  }
}

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })

mkdirSync(join(here, 'lib'), { recursive: true })

// 1. Host half: tsc emits lib/index.js (ESM) + *.d.ts.
run(process.execPath, [modules.typescript, '-p', join(here, 'tsconfig.json')])

// 2. Client half: one browser bundle at lib/client.js. The externals are the
//    web platform seed modules (packages/client/web/src/platform.ts) — the
//    ModuleLoader's require answers exactly these specifiers at runtime.
run(modules.esbuild, [
  join(here, 'src/client/index.ts'),
  '--bundle',
  '--format=cjs',
  '--platform=browser',
  '--target=es2022',
  '--jsx=automatic',
  '--outfile=' + join(here, 'lib/client.js'),
  '--external:react',
  '--external:react/jsx-runtime',
  '--external:react-dom',
  '--external:react-dom/client',
  '--external:@deepseek-ai/cordis',
  '--external:@deepseek-ai/dsh-client-ui-slots',
  '--external:@deepseek-ai/dsh-client-web-react',
  '--external:@deepseek-ai/dsh-client-ui-primitives',
  '--external:@deepseek-ai/dsh-client-ui-attachment',
  '--external:@deepseek-ai/dsh-client-schema-form',
  '--define:process.env.NODE_ENV="production"',
  '--banner:js=window.__ModuleLoader__.load({ id: "dsh-plugin-git-status", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  '--footer:js=return module.exports; } });',
])
