import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

type AuthShellProps = {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-[1.05fr_1fr]">
      <IdentityPanel />

      <section className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Mark className="size-5" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              relayd
            </span>
            <span className="font-mono-tight text-[10px] text-muted-foreground">
              /whatsapp
            </span>
          </Link>
          <Link
            to="/"
            className="font-mono-tight text-[11px] text-muted-foreground hover:text-foreground"
          >
            ← back home
          </Link>
        </header>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-12">
            <p className="font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              <span className="text-brand">▮</span> {eyebrow}
            </p>
            <h1 className="text-balance mt-4 font-heading text-3xl leading-[1.05] font-semibold tracking-[-0.02em] md:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="text-pretty mt-3 text-sm text-muted-foreground">
                {subtitle}
              </p>
            ) : null}

            <div className="mt-8">{children}</div>

            {footer ? (
              <p className="mt-8 font-mono-tight text-[11px] text-muted-foreground">
                {footer}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="font-mono-tight text-[10px] tracking-wide text-muted-foreground uppercase">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>protected · TLS 1.3</span>
            <span aria-hidden>·</span>
            <a className="hover:text-foreground" href="#">
              terms
            </a>
            <a className="hover:text-foreground" href="#">
              privacy
            </a>
            <a className="hover:text-foreground" href="#">
              status
            </a>
          </div>
        </footer>
      </section>
    </div>
  )
}

function IdentityPanel() {
  return (
    <aside className="relative hidden overflow-hidden border-r border-border bg-card lg:flex lg:flex-col">
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-[420px] rounded-full bg-brand/15 blur-3xl"
      />

      <div className="relative flex h-full flex-col p-10">
        <div className="flex items-center justify-between font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
            </span>
            console / authenticated session
          </div>
          <span>node-04 · eu-west-2</span>
        </div>

        <div className="mt-auto">
          <blockquote className="text-balance font-heading text-3xl leading-[1.1] font-medium tracking-tight">
            "Two ops people now do the work of a small support team — and the
            customers actually reply."
          </blockquote>
          <figcaption className="mt-5 font-mono-tight text-[11px] text-muted-foreground">
            — Asha P. · head of ops, Trellis & Vine
          </figcaption>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border/60 pt-6">
          {[
            ['12.4k', 'msg / min'],
            ['99.97%', 'delivery'],
            ['4 200+', 'workspaces'],
          ].map(([v, k]) => (
            <div key={k}>
              <div className="font-heading text-xl font-semibold tracking-tight tabular-nums">
                {v}
              </div>
              <div className="font-mono-tight mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                {k}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="2.5" width="19" height="19" className="text-foreground" />
      <path d="M2.5 12 H21.5" className="text-foreground" />
      <path d="M12 2.5 V21.5" className="text-foreground" />
      <circle cx="17" cy="7" r="1.5" className="fill-brand stroke-brand" />
    </svg>
  )
}
