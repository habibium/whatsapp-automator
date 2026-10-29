import type { components } from '@/api/schema'

type FieldErrors<Name extends string> = Partial<
  Record<Name, Array<{ message: string }>>
>

/** Maps the server's per-field validation messages onto TanStack Form fields. */
export function toFieldErrors<Name extends string>(
  error: unknown,
  names: readonly Name[],
) {
  const details = (error as components['schemas']['ErrorBody'] | undefined)
    ?.details
  if (!details) return null
  const fields: FieldErrors<Name> = {}
  for (const name of names) {
    const messages = details[name]
    if (messages?.length) {
      fields[name] = messages.map((message) => ({ message }))
    }
  }
  return Object.keys(fields).length > 0 ? fields : null
}

export function toStatusMessage(
  errors: ReadonlyArray<{ message?: string } | undefined>,
) {
  const messages = new Set(
    errors.flatMap((error) => (error?.message ? [error.message] : [])),
  )
  return messages.size > 0 ? [...messages].join('. ') : undefined
}
