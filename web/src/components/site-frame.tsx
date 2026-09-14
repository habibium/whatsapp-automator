import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { HStack } from '@astryxdesign/core/HStack'
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
} from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import {
  colorVars,
  durationVars,
  easeVars,
} from '@astryxdesign/core/theme/tokens.stylex'

import { ThemeToggle } from '@/components/theme-toggle'
import { PRODUCT_NAME, Wordmark } from '@/components/wordmark'

/** Layout's own padding, so header, content and footer share one content line. */
export const FRAME_PADDING = 6
export const FRAME_WIDTH = 1080

const styles = stylex.create({
  // Astryx leaves the body transparent, so the frame paints the page and
  // stretches Layout's column to the viewport on short pages.
  page: {
    backgroundColor: colorVars['--color-background-body'],
    display: 'grid',
    minHeight: '100dvh',
  },
  // An underline running under the mark reads as a mistake on a wordmark lockup.
  brand: {
    opacity: {
      default: 1,
      '@media (hover: hover)': { default: 1, ':hover': 0.6 },
    },
    textDecoration: 'none',
    transitionDuration: {
      default: durationVars['--duration-fast'],
      '@media (prefers-reduced-motion: reduce)': '0s',
    },
    transitionProperty: 'opacity',
    transitionTimingFunction: easeVars['--ease-standard'],
  },
})

interface SiteFrameProps {
  action?: ReactNode
  children: ReactNode
}

/** One chrome for every page: wordmark, a single header action, quiet footer. */
export function SiteFrame({ action, children }: SiteFrameProps) {
  return (
    <Layout
      height="auto"
      contentWidth={FRAME_WIDTH}
      padding={FRAME_PADDING}
      xstyle={styles.page}
      header={
        <LayoutHeader role="banner">
          <HStack gap={4} justify="between" vAlign="center">
            <Link href="/" color="primary" xstyle={styles.brand}>
              <Wordmark />
            </Link>
            {action}
          </HStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent isScrollable={false} role="main">
          {children}
        </LayoutContent>
      }
      footer={
        <LayoutFooter role="contentinfo" hasDivider>
          <HStack gap={4} justify="between" vAlign="center" wrap="wrap">
            <Text type="supporting">© 2026 {PRODUCT_NAME}</Text>
            <ThemeToggle />
          </HStack>
        </LayoutFooter>
      }
    />
  )
}
