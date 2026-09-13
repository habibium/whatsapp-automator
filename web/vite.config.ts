import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { SPEC, generate } from './scripts/openapi-types.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function openapiTypes(): Plugin {
  const specPath = fileURLToPath(SPEC)
  return {
    name: 'openapi-types',
    async configureServer(server) {
      const run = async () => {
        try {
          if ((await generate({ write: true })) === 'stale') {
            server.config.logger.info('regenerated src/api/schema.d.ts', {
              timestamp: true,
            })
          }
        } catch (err) {
          server.config.logger.error(`openapi types: ${String(err)}`)
        }
      }
      await run()
      server.watcher.add(specPath)
      server.watcher.on('change', (file) => {
        if (file === specPath) void run()
      })
    },
  }
}

const config = defineConfig({
  server: {
    allowedHosts: ['ezown-dev.naxata.com'],
    proxy: {
      '/api': 'http://localhost:8000/',
    },
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    openapiTypes(),
    devtools(),
    // Unlayered product CSS beats every named Astryx layer regardless of
    // source order, which is what `xstyle` overrides need.
    stylex.vite({
      useCSSLayers: false,
      unstable_moduleResolution: { type: 'commonJS', rootDir },
      aliases: { '@/*': [path.join(rootDir, 'src/*')] },
    }),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
})

export default config
