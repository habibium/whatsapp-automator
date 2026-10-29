export const TOO_MANY_ATTEMPTS = 'Too many attempts.'

/** The wait a 429 asks for, in whole seconds. `Retry-After` may also be an HTTP date. */
export function retryAfterSeconds(response: Response) {
  const value = response.headers.get('Retry-After')?.trim()
  if (!value) return undefined
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : (Date.parse(value) - Date.now()) / 1000
  return Number.isNaN(seconds) ? undefined : Math.max(0, Math.ceil(seconds))
}

/** Such as "Try again in about 3 minutes." */
export function tryAgainIn(seconds: number | undefined) {
  if (!seconds) return 'Try again in a moment.'
  if (seconds < 60) {
    return `Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`
  }
  const minutes = Math.ceil(seconds / 60)
  return `Try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`
}
