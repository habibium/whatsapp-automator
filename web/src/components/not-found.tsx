import * as stylex from '@stylexjs/stylex'
import { useCanGoBack, useLocation, useRouter } from '@tanstack/react-router'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { HStack } from '@astryxdesign/core/HStack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import {
  durationVars,
  easeVars,
  fontWeightVars,
  textSizeVars,
} from '@astryxdesign/core/theme/tokens.stylex'

import { SectionIndex } from '@/components/section-index'
import { SiteFrame } from '@/components/site-frame'

const COLUMN_WIDTH = 560
const SIGNUP_HREF = '/signup'

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
  // Below the hero's ramp, above the auth pages' display-3: a recovery page
  // states a fact, it is not the site's masthead.
  title: {
    fontSize: {
      default: textSizeVars['--font-size-3xl'],
      '@media (min-width: 560px)': textSizeVars['--font-size-4xl'],
      '@media (min-width: 900px)': textSizeVars['--font-size-5xl'],
    },
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
    maxWidth: '18ch',
  },
  measure: { maxWidth: '45ch' },
  // A mistyped address is one unbroken word as far as the browser is concerned.
  path: { overflowWrap: 'anywhere' },
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
})

/** Root-route fallback for any address the router cannot match. */
export function NotFound() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const { href } = useLocation()

  return (
    <SiteFrame
      // Signing in is one of the addresses that lands here, so the header
      // offers the destination that does exist.
      action={
        <Button label="Create account" variant="secondary" href={SIGNUP_HREF} />
      }
    >
      <VStack minHeight="100%" paddingBlock={10} vAlign="center">
        <VStack gap={8} maxWidth={COLUMN_WIDTH}>
          <VStack gap={5} xstyle={styles.reveal}>
            <SectionIndex index="404" label="Page not found" />
            <VStack gap={3}>
              <Heading
                level={1}
                type="display-1"
                textWrap="balance"
                xstyle={styles.title}
              >
                There is nothing at this address.
              </Heading>
              <Text color="secondary" size="lg" xstyle={styles.measure}>
                The link that brought you here may be out of date, or the
                address mistyped. Nothing has gone wrong with your account.
              </Text>
            </VStack>
          </VStack>

          <VStack gap={6} xstyle={[styles.reveal, styles.revealLate]}>
            <VStack gap={0}>
              <Divider />
              <HStack gap={4} justify="between" paddingBlock={3} wrap="wrap">
                <Text type="supporting" xstyle={styles.tracked}>
                  Requested
                </Text>
                <Text type="code" size="sm" xstyle={styles.path}>
                  {href}
                </Text>
              </HStack>
              <Divider />
            </VStack>

            <HStack gap={3} wrap="wrap">
              <Button
                label="Go to the homepage"
                variant="primary"
                size="lg"
                href="/"
              />
              {canGoBack ? (
                <Button
                  label="Go back"
                  variant="ghost"
                  size="lg"
                  onClick={() => router.history.back()}
                />
              ) : null}
            </HStack>
          </VStack>
        </VStack>
      </VStack>
    </SiteFrame>
  )
}
