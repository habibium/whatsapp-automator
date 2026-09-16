import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin'
import { compression, defineAlgorithm } from 'vite-plugin-compression2'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { constants as zlib } from 'node:zlib'
import type { HtmlTagDescriptor, Plugin } from 'vite'
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

// Vite preloads the entry's static imports only, and has no font preload at all.
function preloadCriticalAssets(): Plugin {
  const indexRoute =
    path.join(rootDir, 'src/routes/index.tsx') + '?tsr-split=component'
  const preloadedFonts = [/-400-normal-\w+\.woff2$/, /-600-normal-\w+\.woff2$/]
  return {
    name: 'preload-critical-assets',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const names = Object.entries(ctx.bundle ?? {})
        const tags: HtmlTagDescriptor[] = []

        const route = names.find(
          ([, out]) =>
            out.type === 'chunk' && out.facadeModuleId === indexRoute,
        )
        if (route) {
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              crossorigin: true,
              href: `${ctx.path.replace(/index\.html$/, '')}${route[0]}`,
            },
            injectTo: 'head',
          })
        }

        for (const [name] of names) {
          if (!preloadedFonts.some((re) => re.test(name))) continue
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              crossorigin: true,
              href: `${ctx.path.replace(/index\.html$/, '')}${name}`,
            },
            injectTo: 'head',
          })
        }

        return tags
      },
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
  build: {
    // Browser targets all support modulepreload natively.
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
  },
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
    preloadCriticalAssets(),
    // Served by the Rust server's `precompressed_br`/`precompressed_gzip`, so
    // quality is a build-time cost only.
    compression({
      include: /\.(html|css|js|mjs|json|svg|xml|txt|map)$/,
      threshold: 1024,
      algorithms: [
        defineAlgorithm('gzip', { level: 9 }),
        defineAlgorithm('brotliCompress', {
          params: { [zlib.BROTLI_PARAM_QUALITY]: 11 },
        }),
      ],
    }),
  ],
})

export default config
