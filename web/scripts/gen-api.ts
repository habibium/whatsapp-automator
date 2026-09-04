import { generate } from './openapi-types'

await generate({ write: !process.argv.includes('--check') })
