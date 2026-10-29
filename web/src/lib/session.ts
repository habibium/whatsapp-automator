import { queryOptions } from '@tanstack/react-query'

import type { QueryClient } from '@tanstack/react-query'
import type { components } from '@/api/schema'

export type User = components['schemas']['UserResponse']
type Session = components['schemas']['SessionResponse']

export const HOME_HREF = '/dashboard'
export const SIGNIN_HREF = '/signin'
export const SIGNUP_HREF = '/signup'

// A bare fetch instead of `$api`: route guards ship with every page, and the
// generated client would bring openapi-fetch and react-query's hooks along.
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  // Guards re-check at most once a minute, so a sign-out in another tab still lands.
  staleTime: 60_000,
  queryFn: async (): Promise<Session> => {
    const response = await fetch('/api/auth/session')
    if (!response.ok) {
      throw new Error(`Session check failed with ${response.status}`)
    }
    return response.json()
  },
})

/** `null` when signed out, and also when the check itself fails: a route never stalls on it. */
export async function currentUser(queryClient: QueryClient) {
  try {
    const { user } = await queryClient.fetchQuery(sessionQuery)
    return user
  } catch {
    return null
  }
}

/** For responses that already settle who is signed in, so guards skip a refetch. */
export function setSessionUser(queryClient: QueryClient, user: User | null) {
  queryClient.setQueryData(sessionQuery.queryKey, { user })
}

/**
 * Keeps a crafted `?redirect=` from sending someone off-site once they sign in: `//host` and
 * `/\host` leave the origin, and browsers drop tabs and newlines, so `/<tab>/host` would too.
 */
export function safeRedirect(target: string | undefined) {
  return target && /^\/(?![/\\])\S*$/.test(target) ? target : HOME_HREF
}
