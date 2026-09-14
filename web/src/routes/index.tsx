import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Divider } from '@astryxdesign/core/Divider'
import { Grid } from '@astryxdesign/core/Grid'
import { HStack } from '@astryxdesign/core/HStack'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import {
  borderVars,
  colorVars,
  durationVars,
  easeVars,
  fontWeightVars,
  spacingVars,
  textSizeVars,
} from '@astryxdesign/core/theme/tokens.stylex'

import type { TableColumn } from '@astryxdesign/core/Table'

import { SectionIndex } from '@/components/section-index'
import { SiteFrame } from '@/components/site-frame'

export const Route = createFileRoute('/')({ component: Home })

const SIGNUP_HREF = '/signup'
const SIGNIN_HREF = '/signin'

interface Run extends Record<string, unknown> {
  id: string
  time: string
  name: string
  kind: string
  qualifier: string
  state: 'sent' | 'live' | 'queued'
  status: string
}

const runs: Run[] = [
  {
    id: 'r1',
    time: '07:45',
    name: 'Opening hours',
    kind: 'Auto-reply',
    qualifier: 'asks about opening times',
    state: 'live',
    status: 'Answering',
  },
  {
    id: 'r2',
    time: '09:30',
    name: 'Thursday class reminder',
    kind: 'Scheduled',
    qualifier: '42 contacts',
    state: 'sent',
    status: 'Sent',
  },
  {
    id: 'r3',
    time: '12:00',
    name: 'Today’s menu',
    kind: 'Broadcast',
    qualifier: '128 contacts',
    state: 'sent',
    status: 'Sent',
  },
  {
    id: 'r4',
    time: '16:00',
    name: 'Unpaid invoice nudge',
    kind: 'Scheduled',
    qualifier: '6 contacts',
    state: 'sent',
    status: 'Sent',
  },
  {
    id: 'r5',
    time: '18:30',
    name: 'Closed for the day',
    kind: 'Auto-reply',
    qualifier: 'after closing time',
    state: 'queued',
    status: 'Queued',
  },
]

const dotVariants = {
  sent: 'success',
  live: 'accent',
  queued: 'neutral',
} as const

const capabilities = [
  {
    term: 'Scheduled messages',
    body: 'Write a message now and pick the date and time it leaves. Edit or cancel it any time before it sends.',
  },
  {
    term: 'Auto-replies',
    body: 'Match an incoming message against rules you write, and answer it the way you would have.',
  },
  {
    term: 'Broadcasts',
    body: 'Send one message to a list. It arrives as an ordinary chat, delivered one contact at a time.',
  },
  {
    term: 'Delivery log',
    body: 'See what went out, who received it, and what came back. Every run is recorded.',
  },
]

const steps = [
  {
    term: 'Scan',
    body: 'Scan a QR code with WhatsApp, exactly as you would to open WhatsApp Web.',
  },
  {
    term: 'Write',
    body: 'Pick a time and a list, or write the rule that should answer for you.',
  },
  {
    term: 'Run',
    body: 'Leave it running. The log tells you what happened while you were away.',
  },
]

const fadeUp = stylex.keyframes({
  from: { opacity: 0, transform: 'translateY(10px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

const styles = stylex.create({
  tracked: {
    fontWeight: fontWeightVars['--font-weight-medium'],
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  // A narrow index column in the margin, the way a Swiss grid numbers its parts.
  // Baseline alignment sits the number on the heading's own first baseline;
  // matching the box tops instead leaves it 3px high, which reads as a slip.
  sectionGrid: {
    alignItems: 'baseline',
    columnGap: spacingVars['--spacing-12'],
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 900px)': '150px minmax(0, 1fr)',
    },
    rowGap: spacingVars['--spacing-6'],
  },
  defRow: {
    borderTopColor: colorVars['--color-border'],
    borderTopStyle: 'solid',
    borderTopWidth: {
      default: borderVars['--border-width'],
      ':first-child': 0,
    },
    columnGap: spacingVars['--spacing-8'],
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 640px)': '200px minmax(0, 1fr)',
    },
    paddingBlock: spacingVars['--spacing-5'],
    rowGap: spacingVars['--spacing-2'],
  },
  stepGrid: {
    columnGap: spacingVars['--spacing-8'],
    gridTemplateColumns: {
      default: 'minmax(0, 1fr)',
      '@media (min-width: 720px)': 'repeat(3, minmax(0, 1fr))',
    },
    rowGap: spacingVars['--spacing-6'],
  },
  // `ch` resolves against the element's own font size, so this holds a 40-60
  // character line only while it sits on the text itself, never on a wrapper.
  measure: { maxWidth: '45ch' },
  headline: { maxWidth: '32ch' },
  // One 640px swap, used twice: the header keeps only the destination the hero
  // is not already offering on screen, and the log swaps in its compact table.
  wideOnly: {
    display: {
      default: 'none',
      '@media (min-width: 640px)': 'flex',
    },
  },
  narrowOnly: {
    display: {
      default: 'flex',
      '@media (min-width: 640px)': 'none',
    },
  },
  // Below 640 the trailing header action is the ghost button, whose own inline
  // padding would otherwise hold its label off the grid edge the wordmark sits on.
  headerActions: {
    marginInlineEnd: {
      default: `calc(${spacingVars['--spacing-3']} * -1)`,
      '@media (min-width: 640px)': 0,
    },
  },
  // display-1 tops out at 42px, which reads as a heading rather than a masthead
  // on a wide page; the step up stays derived from the type scale.
  heroTitle: {
    fontSize: {
      default: textSizeVars['--font-size-4xl'],
      '@media (min-width: 560px)': textSizeVars['--font-size-5xl'],
      '@media (min-width: 900px)': `calc(${textSizeVars['--font-size-5xl']} * 1.4)`,
      '@media (min-width: 1180px)': `calc(${textSizeVars['--font-size-5xl']} * 1.62)`,
    },
    letterSpacing: '-0.035em',
    lineHeight: 1.04,
    maxWidth: '15ch',
  },
  reveal: {
    animationDuration: durationVars['--duration-medium'],
    animationFillMode: 'both',
    animationName: {
      default: fadeUp,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationTimingFunction: easeVars['--ease-standard'],
  },
  revealLate: { animationDelay: durationVars['--duration-fast-min'] },
  // The page's one surface. Card's own background matches the body in dark
  // mode, so the instrument would disappear into the page without this.
  panel: { backgroundColor: colorVars['--color-background-surface'] },
})

function RunTime({ run }: { run: Run }) {
  return (
    <Text hasTabularNumbers weight="medium">
      {run.time}
    </Text>
  )
}

// The status word sits next to the dot in both presentations, so the dot itself
// is decoration and would otherwise be announced twice.
function RunDot({ run }: { run: Run }) {
  return (
    <StatusDot
      aria-hidden="true"
      variant={dotVariants[run.state]}
      label={run.status}
      isPulsing={run.state === 'live'}
    />
  )
}

const columns: TableColumn<Run>[] = [
  {
    key: 'time',
    header: 'Time',
    width: pixel(76),
    renderCell: (run) => <RunTime run={run} />,
  },
  {
    key: 'name',
    header: 'Automation',
    width: proportional(1),
    renderCell: (run) => (
      <VStack gap={0.5}>
        <Text weight="medium" display="block">
          {run.name}
        </Text>
        <Text type="supporting" display="block">
          {run.kind} · {run.qualifier}
        </Text>
      </VStack>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    width: pixel(116),
    align: 'end',
    renderCell: (run) => (
      <HStack gap={2} hAlign="end" vAlign="center">
        <RunDot run={run} />
        <Text type="supporting" textWrap="nowrap">
          {run.status}
        </Text>
      </HStack>
    ),
  },
]

// Three columns cannot hold a phone width without wrapping every row onto three
// lines. The status column folds into the dot and the second line, which the
// qualifier gives up: what ran and how it went outranks how many it reached.
const compactColumns: TableColumn<Run>[] = [
  {
    key: 'time',
    header: 'Time',
    width: pixel(72),
    renderCell: (run) => <RunTime run={run} />,
  },
  {
    key: 'name',
    header: 'Automation',
    width: proportional(1),
    renderCell: (run) => (
      <VStack gap={0.5}>
        <HStack gap={3} justify="between" vAlign="center">
          <Text weight="medium">{run.name}</Text>
          <RunDot run={run} />
        </HStack>
        <Text type="supporting" display="block">
          {run.kind} · {run.status}
        </Text>
      </VStack>
    ),
  },
]

interface PageSectionProps {
  index: string
  label: string
  headingId: string
  title: string
  lede: string
  children: ReactNode
}

function PageSection({
  index,
  label,
  headingId,
  title,
  lede,
  children,
}: PageSectionProps) {
  return (
    <VStack as="section" aria-labelledby={headingId} paddingBlock={10}>
      <Grid xstyle={styles.sectionGrid}>
        <SectionIndex index={index} label={label} />
        <VStack gap={8}>
          <VStack gap={3}>
            <Heading
              id={headingId}
              level={2}
              type="display-3"
              textWrap="balance"
              xstyle={styles.headline}
            >
              {title}
            </Heading>
            <Text color="secondary" size="lg" xstyle={styles.measure}>
              {lede}
            </Text>
          </VStack>
          {children}
        </VStack>
      </Grid>
    </VStack>
  )
}

function Home() {
  return (
    <SiteFrame
      action={
        <HStack gap={2} vAlign="center" xstyle={styles.headerActions}>
          <Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />
          <Button
            label="Create account"
            variant="secondary"
            href={SIGNUP_HREF}
            xstyle={styles.wideOnly}
          />
        </HStack>
      }
    >
      <VStack gap={0}>
        <VStack
          as="section"
          aria-labelledby="hero-title"
          gap={8}
          paddingBlockEnd={10}
          paddingBlockStart={10}
        >
          <VStack gap={5} xstyle={styles.reveal}>
            <Text type="supporting" xstyle={styles.tracked}>
              Scheduling · Auto-replies · Broadcasts
            </Text>
            <Heading
              id="hero-title"
              level={1}
              type="display-1"
              xstyle={styles.heroTitle}
            >
              Automate WhatsApp. Keep control of it.
            </Heading>
            <Text color="secondary" size="lg" xstyle={styles.measure}>
              Link the account you already use, then schedule messages, answer
              the questions you always get, and reach a whole contact list one
              chat at a time.
            </Text>
          </VStack>
          <VStack
            gap={3}
            hAlign="start"
            xstyle={[styles.reveal, styles.revealLate]}
          >
            <Button
              label="Create account"
              variant="primary"
              size="lg"
              href={SIGNUP_HREF}
            />
            <Text type="supporting">
              You connect it by scanning a QR code, the same way WhatsApp Web
              does.
            </Text>
          </VStack>
        </VStack>

        <Divider />

        <PageSection
          index="01"
          label="Live view"
          headingId="live-view"
          title="Everything it did today, on one line each."
          lede="Scheduled sends, auto-replies and broadcasts land in the same log, so you can tell at a glance what ran, what is waiting, and what is answering right now."
        >
          <Card padding={4} elevation="low" xstyle={styles.panel}>
            <HStack justify="between" paddingBlockEnd={3} vAlign="center">
              <Text type="label">Thursday, 12 March</Text>
              <HStack gap={2} vAlign="center">
                <StatusDot
                  aria-hidden="true"
                  variant="success"
                  label="Account linked"
                  isPulsing
                />
                <Text type="supporting">Account linked</Text>
              </HStack>
            </HStack>
            <VStack xstyle={styles.wideOnly}>
              <Divider isFullBleed />
              <Table
                data={runs}
                columns={columns}
                idKey="id"
                density="spacious"
              />
              <Divider isFullBleed />
            </VStack>
            <VStack xstyle={styles.narrowOnly}>
              <Divider isFullBleed />
              <Table
                data={runs}
                columns={compactColumns}
                idKey="id"
                density="spacious"
              />
              <Divider isFullBleed />
            </VStack>
            <HStack justify="between" paddingBlockStart={3} vAlign="center">
              <Text type="supporting">5 automations</Text>
              <Text type="supporting" hasTabularNumbers>
                Next run 18:30
              </Text>
            </HStack>
          </Card>
        </PageSection>

        <Divider />

        <PageSection
          index="02"
          label="Capabilities"
          headingId="capabilities"
          title="Four things, each done properly."
          lede="No rule engine to learn and no automation that acts on its own. You describe what should happen; the account stays yours."
        >
          <VStack gap={0}>
            {capabilities.map((capability) => (
              <Grid key={capability.term} xstyle={styles.defRow}>
                <Text type="label">{capability.term}</Text>
                <Text color="secondary" xstyle={styles.measure}>
                  {capability.body}
                </Text>
              </Grid>
            ))}
          </VStack>
        </PageSection>

        <Divider />

        <PageSection
          index="03"
          label="How it works"
          headingId="how-it-works"
          title="Three steps, then it runs without you."
          lede="Linking takes about a minute. After that the schedule runs on its own, and every send stays yours to change or stop."
        >
          <Grid xstyle={styles.stepGrid}>
            {steps.map((step) => (
              <VStack key={step.term} gap={2}>
                <Text type="label">{step.term}</Text>
                <Text color="secondary">{step.body}</Text>
              </VStack>
            ))}
          </Grid>
        </PageSection>

        <Divider />

        <PageSection
          index="04"
          label="Get started"
          headingId="get-started"
          title="Link your account and schedule the first message."
          lede="Creating an account takes an email address and a password. You can connect WhatsApp straight after, or come back to it later."
        >
          <VStack gap={3} hAlign="start">
            <Button
              label="Create account"
              variant="primary"
              size="lg"
              href={SIGNUP_HREF}
            />
          </VStack>
        </PageSection>
      </VStack>
    </SiteFrame>
  )
}
