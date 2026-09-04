import { readFile, writeFile } from 'node:fs/promises'
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript'

export const SPEC = new URL('../../openapi.json', import.meta.url)
export const OUT = new URL('../src/api/schema.d.ts', import.meta.url)

async function readIfExists(url: URL) {
  try {
    return await readFile(url, 'utf8')
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT')
      return null
    throw err
  }
}

export async function generate(opts: { write: boolean }) {
  const newJson =
    COMMENT_HEADER + astToString(await openapiTS(SPEC, { silent: true }))
  const currentJson = await readIfExists(OUT)
  if (currentJson === newJson) return 'up-to-date' as const
  if (opts.write) await writeFile(OUT, newJson)
  return 'stale' as const
}
