import { createFileRoute } from '@tanstack/react-router'
import * as stylex from '@stylexjs/stylex'
import { CalendarClock, MessageSquareReply, Users } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { Grid } from '@astryxdesign/core/Grid'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from '@astryxdesign/core/Layout'
import { Section } from '@astryxdesign/core/Section'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { colorVars, spacingVars } from '@astryxdesign/core/theme/tokens.stylex'
import { ThemeToggle } from '@/components/theme-toggle'
import { PRODUCT_NAME, Wordmark } from '@/components/wordmark'

export const Route = createFileRoute('/')({ component: Home })

const SIGNUP_HREF = '/signup'

// Section escapes its container's inline padding and re-applies its own, so this
// must match Layout's `padding` for header, content and footer to share one line.
const FRAME_PADDING = 6

const capabilities = [
  {
    icon: CalendarClock,
    title: 'Schedule messages',
    body: 'Write a message today and pick the date and time it should be sent.',
  },
  {
    icon: MessageSquareReply,
    title: 'Automate replies',
    body: 'Match incoming messages against your own rules and answer them for you.',
  },
  {
    icon: Users,
    title: 'Reach many contacts at once',
    body: 'Send one message to a whole list, delivered chat by chat.',
  },
]

const styles = stylex.create({
  // Astryx leaves the page background transparent, so the frame paints it. The
  // grid stretches Layout's inner column to 100dvh so the footer sits at the
  // bottom on a short page while taller content still scrolls the document.
  page: {
    display: 'grid',
    minHeight: '100dvh',
    backgroundColor: colorVars['--color-background-body'],
  },
  hero: {
    paddingBlockStart: {
      default: spacingVars['--spacing-8'],
      '@media (min-width: 768px)': spacingVars['--spacing-12'],
    },
    paddingBlockEnd: {
      default: spacingVars['--spacing-8'],
      '@media (min-width: 768px)': spacingVars['--spacing-12'],
    },
  },
  heroCopy: { maxWidth: 620 },
  capabilities: {
    paddingBlockEnd: {
      default: spacingVars['--spacing-8'],
      '@media (min-width: 768px)': spacingVars['--spacing-12'],
    },
  },
})

function Home() {
  return (
    <Layout
      height="auto"
      contentWidth={960}
      padding={FRAME_PADDING}
      xstyle={styles.page}
      header={
        <LayoutHeader role="banner">
          <HStack gap={4} justify="between" vAlign="center" wrap="wrap">
            <Wordmark />
            <HStack gap={3} vAlign="center">
              <ThemeToggle />
              <Button
                label="Create account"
                variant="secondary"
                href={SIGNUP_HREF}
              />
            </HStack>
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent isScrollable={false} role="main">
          <Section
            variant="transparent"
            padding={0}
            paddingInline={FRAME_PADDING}
            xstyle={styles.hero}
          >
            <VStack gap={6} hAlign="center">
              <VStack gap={3} hAlign="center" xstyle={styles.heroCopy}>
                <Heading
                  level={1}
                  type="display-2"
                  justify="center"
                  textWrap="balance"
                >
                  Put WhatsApp on autopilot
                </Heading>
                <Text color="secondary" justify="center" textWrap="balance">
                  Schedule messages, answer the questions you always get, and
                  reach your whole contact list from one place.
                </Text>
              </VStack>
              <Button
                label="Create account"
                variant="primary"
                size="lg"
                href={SIGNUP_HREF}
              />
            </VStack>
          </Section>
          <Section
            variant="transparent"
            padding={0}
            paddingInline={FRAME_PADDING}
            xstyle={styles.capabilities}
          >
            <Grid columns={{ minWidth: 260, max: 3 }} gap={6}>
              {capabilities.map((capability) => (
                <VStack key={capability.title} gap={3}>
                  <Icon icon={capability.icon} size="lg" color="accent" />
                  <VStack gap={1}>
                    <Text weight="semibold" display="block">
                      {capability.title}
                    </Text>
                    <Text color="secondary" display="block">
                      {capability.body}
                    </Text>
                  </VStack>
                </VStack>
              ))}
            </Grid>
          </Section>
        </LayoutContent>
      }
      footer={
        <LayoutFooter role="contentinfo" hasDivider>
          <HStack gap={3} justify="between" vAlign="center" wrap="wrap">
            <Wordmark />
            <Text type="supporting">© 2026 {PRODUCT_NAME}</Text>
          </HStack>
        </LayoutFooter>
      }
    />
  )
}
