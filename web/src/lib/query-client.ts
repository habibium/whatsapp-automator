import { QueryClient } from '@tanstack/react-query'

/** One instance, shared by the provider in the root route and by route loaders. */
export const queryClient = new QueryClient()
