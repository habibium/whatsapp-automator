/** A message a page shows once on arrival, carried in history state rather than the URL. */
export type Notice = 'email-verified' | 'password-changed'

declare module '@tanstack/react-router' {
  interface HistoryState {
    notice?: Notice
    /** Prefills the sign-in form after a link settled who the user is. */
    email?: string
  }
}
