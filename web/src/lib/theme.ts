import { useSyncExternalStore } from 'react'
import type { ThemeMode } from '@astryxdesign/core/theme'

// Also read by the pre-paint inline script at the top of index.html.
const STORAGE_KEY = 'wa-color-scheme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredPreference(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

// Read before the first render so the initial <Theme mode> is already correct.
let preference = readStoredPreference()

const listeners = new Set<() => void>()

function subscribePreference(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getPreference(): ThemeMode {
  return preference
}

function setPreference(next: ThemeMode): void {
  if (next === preference) {
    return
  }
  preference = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {}
  for (const listener of listeners) {
    listener()
  }
}

const darkQuery = window.matchMedia(DARK_QUERY)

function subscribeSystem(onChange: () => void): () => void {
  darkQuery.addEventListener('change', onChange)
  return () => {
    darkQuery.removeEventListener('change', onChange)
  }
}

function getSystemScheme(): 'light' | 'dark' {
  return darkQuery.matches ? 'dark' : 'light'
}

export interface ColorScheme {
  preference: ThemeMode
  /** The scheme actually in effect — `preference` with `'system'` resolved. */
  resolved: 'light' | 'dark'
  setPreference: (next: ThemeMode) => void
}

export function useColorScheme(): ColorScheme {
  const current = useSyncExternalStore(subscribePreference, getPreference)
  const system = useSyncExternalStore(subscribeSystem, getSystemScheme)

  return {
    preference: current,
    resolved: current === 'system' ? system : current,
    setPreference,
  }
}
