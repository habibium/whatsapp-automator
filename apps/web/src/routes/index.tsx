import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  ChecksIcon,
  ClockCountdownIcon,
  CodeIcon,
  GraphIcon,
  LightningIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react'
import { buttonVariants } from '~/components/ui/button'
import { Separator } from '~/components/ui/separator'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <div className="relative isolate min-h-svh bg-background text-foreground">
      <div
        aria-hidden
        className="bg-grid bg-grid-fade pointer-events-none absolute inset-0 -z-10"
      />

      <TopBar />
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-6">
        <Hero />
        <Capabilities />
        <SecondaryCTA />
      </main>

      <Footer />
    </div>
  )
}

function TopBar() {
  return (
    <div className="border-b border-border/60 bg-background/60 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-1.5 font-mono-tight text-[10px] tracking-wide text-muted-foreground uppercase">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
          </span>
          <span>system / nominal</span>
          <span aria-hidden>·</span>
          <span>p99 142ms</span>
          <span aria-hidden>·</span>
          <span>throughput 12.4k/min</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <span>build 0.1.0-α</span>
          <span aria-hidden>·</span>
          <span>region eu-west-2</span>
        </div>
      </div>
    </div>
  )
}

function Nav() {
  return (
    <header className="border-b border-border/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="group/wm flex items-center gap-2.5">
          <Mark className="size-5" />
          <span className="font-heading text-sm font-semibold tracking-tight">
            relayd
          </span>
          <span className="font-mono-tight text-[10px] text-muted-foreground">
            /whatsapp
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-xs text-muted-foreground md:flex">
          <a className="hover:text-foreground" href="#capabilities">
            Capabilities
          </a>
          <a className="hover:text-foreground" href="#how">
            How it works
          </a>
          <a className="hover:text-foreground" href="#pricing">
            Pricing
          </a>
          <a className="hover:text-foreground" href="#docs">
            Docs
          </a>
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            to="/sign-in"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Sign in
          </Link>
          <Link
            to="/sign-up"
            className={buttonVariants({
              size: 'sm',
              className:
                'bg-brand text-brand-foreground hover:bg-brand/90',
            })}
          >
            Start free
            <ArrowRightIcon weight="bold" />
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="grid grid-cols-1 gap-10 py-14 md:grid-cols-12 md:gap-8 md:py-20">
      <div className="md:col-span-7">
        <p className="font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          <span className="text-brand">▮</span> outbound · console
        </p>
        <h1 className="text-balance mt-5 font-heading text-5xl leading-[0.95] font-semibold tracking-[-0.03em] md:text-7xl">
          Operate
          <br />
          WhatsApp at the
          <br />
          <span className="relative inline-flex">
            <span className="relative z-10">speed of code.</span>
            <span
              aria-hidden
              className="absolute right-0 -bottom-1 left-0 h-3 bg-brand/30"
            />
          </span>
        </h1>
        <p className="text-pretty mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Send, schedule and orchestrate WhatsApp messages from a single
          terminal-grade console. Built for operators who'd rather write a
          template than open the app.
        </p>

        <div className="mt-8 flex items-center gap-2">
          <Link
            to="/sign-up"
            className={buttonVariants({
              size: 'lg',
              className:
                'bg-brand text-brand-foreground hover:bg-brand/90',
            })}
          >
            Create account
            <ArrowRightIcon weight="bold" />
          </Link>
          <a
            href="#how"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            How it works
          </a>
        </div>

        <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
          {[
            ['12.4k', 'msg / min'],
            ['99.97%', 'delivery'],
            ['142ms', 'p99 latency'],
          ].map(([v, k]) => (
            <div key={k}>
              <dt className="font-heading text-2xl font-semibold tracking-tight">
                {v}
              </dt>
              <dd className="font-mono-tight mt-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                {k}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="md:col-span-5">
        <MessageStream />
      </div>
    </section>
  )
}

function MessageStream() {
  const lines: Array<{
    id: string
    to: string
    body: string
    status: 'queued' | 'sent' | 'delivered' | 'read'
    ts: string
  }> = [
    { id: '0x9a4f', to: '+44 7…112', body: 'Order #7281 dispatched — track here', status: 'read', ts: '12:04:11' },
    { id: '0x9a50', to: '+44 7…448', body: 'Hi Maya — your appointment is tomorrow', status: 'delivered', ts: '12:04:11' },
    { id: '0x9a51', to: '+33 6…009', body: 'Réservation confirmée pour 19:30', status: 'delivered', ts: '12:04:12' },
    { id: '0x9a52', to: '+1 415…776', body: 'Your one-time code is 4421', status: 'sent', ts: '12:04:12' },
    { id: '0x9a53', to: '+49 1…220', body: 'Vielen Dank — Sendung folgt heute', status: 'queued', ts: '12:04:13' },
    { id: '0x9a54', to: '+34 6…188', body: 'Bienvenida, María. Tu acceso está listo', status: 'queued', ts: '12:04:13' },
  ]

  const statusStyles = {
    queued: 'text-muted-foreground',
    sent: 'text-foreground',
    delivered: 'text-brand',
    read: 'text-brand',
  } as const

  const StatusIcon = ({ status }: { status: keyof typeof statusStyles }) => {
    if (status === 'queued') return <ClockCountdownIcon className="size-3" />
    if (status === 'sent') return <CheckCircleIcon className="size-3" />
    return <ChecksIcon className="size-3" />
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-2 -z-10 bg-grid opacity-50"
      />
      <div className="relative overflow-hidden border border-border bg-card shadow-[0_30px_60px_-30px_oklch(0_0_0/0.25)]">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 font-mono-tight text-[10px] tracking-wider text-muted-foreground uppercase">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
            </span>
            relay.outbound
          </div>
          <span>live · 12:04 utc</span>
        </div>

        <ol className="divide-y divide-border/60 font-mono-tight text-[11px]">
          {lines.map((l, i) => (
            <li
              key={l.id}
              className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-3 py-2"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="w-10 text-[10px] text-muted-foreground/70 tabular-nums">
                {String(i + 1).padStart(3, '0')}
              </span>
              <span className="text-muted-foreground tabular-nums">{l.ts}</span>
              <span className="truncate">
                <span className="text-muted-foreground">{l.to}</span>{' '}
                <span className="text-foreground/90">{l.body}</span>
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] tracking-wider uppercase ${statusStyles[l.status]}`}
              >
                <StatusIcon status={l.status} />
                {l.status}
              </span>
            </li>
          ))}
        </ol>

        <div className="border-t border-border bg-muted/30 px-3 py-2 font-mono-tight text-[10px] text-muted-foreground">
          <span className="text-foreground">$</span> relay send --template
          order_dispatched --batch 1.2k
          <span className="ml-1 inline-block h-2.5 w-1 translate-y-0.5 animate-pulse bg-brand align-middle" />
        </div>
      </div>
    </div>
  )
}

function Capabilities() {
  const items = [
    {
      icon: <CodeIcon weight="duotone" className="size-5" />,
      eyebrow: '01 / templates',
      title: 'Versioned templates',
      body: 'Compose, review and ship message templates like code. Diff, rollback, branch.',
    },
    {
      icon: <LightningIcon weight="duotone" className="size-5" />,
      eyebrow: '02 / throughput',
      title: 'High-rate dispatch',
      body: 'Batches up to 12k messages per minute with per-recipient pacing and retries.',
    },
    {
      icon: <GraphIcon weight="duotone" className="size-5" />,
      eyebrow: '03 / signals',
      title: 'Delivery telemetry',
      body: 'Read, delivered, opened, replied — streamed to your dashboards and webhooks.',
    },
    {
      icon: <ShieldCheckIcon weight="duotone" className="size-5" />,
      eyebrow: '04 / consent',
      title: 'Consent-aware',
      body: 'Opt-in registry, quiet hours and per-region policies enforced before send.',
    },
  ]

  return (
    <section id="capabilities" className="py-12 md:py-20">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <p className="font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            ▮ what's inside
          </p>
          <h2 className="text-balance mt-3 max-w-xl font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Built for operators, not marketers.
          </h2>
        </div>
        <a
          href="#docs"
          className="hidden items-center gap-1 font-mono-tight text-[11px] text-muted-foreground hover:text-foreground md:inline-flex"
        >
          read the docs
          <ArrowUpRightIcon weight="bold" className="size-3" />
        </a>
      </div>

      <Separator />

      <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-4">
        {items.map((it) => (
          <article
            key={it.title}
            className="group/cap relative flex flex-col gap-3 p-5 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                {it.eyebrow}
              </span>
              <span className="text-muted-foreground transition-colors group-hover/cap:text-brand">
                {it.icon}
              </span>
            </div>
            <h3 className="font-heading text-base font-semibold tracking-tight">
              {it.title}
            </h3>
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
              {it.body}
            </p>
          </article>
        ))}
      </div>

      <Separator />
    </section>
  )
}

function SecondaryCTA() {
  return (
    <section id="how" className="py-14 md:py-24">
      <div className="relative overflow-hidden border border-border bg-card">
        <div
          aria-hidden
          className="bg-grid pointer-events-none absolute inset-0 opacity-50"
        />
        <div className="relative grid grid-cols-1 gap-8 p-8 md:grid-cols-[1.4fr_1fr] md:items-end md:p-12">
          <div>
            <p className="font-mono-tight text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              ▮ get started
            </p>
            <h2 className="text-balance mt-3 max-w-xl font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Plug in a number. Send a hundred messages by lunch.
            </h2>
            <p className="text-pretty mt-4 max-w-md text-sm text-muted-foreground">
              No credit card. Free tier covers your first 1,000 conversations
              per month. Bring your own WhatsApp Business number — we handle
              the rest.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Link
              to="/sign-up"
              className={buttonVariants({
                size: 'lg',
                className:
                  'bg-brand text-brand-foreground hover:bg-brand/90',
              })}
            >
              Create your account
              <ArrowRightIcon weight="bold" />
            </Link>
            <Link
              to="/sign-in"
              className="font-mono-tight text-[11px] text-muted-foreground hover:text-foreground"
            >
              already have one? sign in →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-6 py-5 font-mono-tight text-[10px] tracking-wide text-muted-foreground uppercase md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <Mark className="size-3.5" />
          <span>relayd · whatsapp ops</span>
          <span aria-hidden>·</span>
          <span>© 2026</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground">
            status
          </a>
          <a href="#" className="hover:text-foreground">
            terms
          </a>
          <a href="#" className="hover:text-foreground">
            privacy
          </a>
          <a href="#" className="hover:text-foreground">
            contact
          </a>
        </div>
      </div>
    </footer>
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
