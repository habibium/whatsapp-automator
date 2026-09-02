import createClient from 'openapi-fetch'
import createQueryClient from 'openapi-react-query'
import type { paths } from './schema'

export const api = createClient<paths>()
export const $api = createQueryClient(api)
