import { generate } from './openapi-types.ts'

const isCheck = process.argv.includes('--check')
const status = await generate({ write: !isCheck })

if (status === 'stale') {
  if (!isCheck) {
    console.log('[gen-api-types] types updated')
    process.exit(0)
  }
  console.error('[gen-api-types] types are out of date')
  process.exit(1)
}

console.log('[gen-api-types] types are up to date')
