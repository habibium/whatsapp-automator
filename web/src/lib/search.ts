/** Search params arrive untyped from the URL; anything but a string is dropped. */
export function stringParam(value: unknown) {
  return typeof value === 'string' ? value : undefined
}
