import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Link } from '@astryxdesign/core/Link'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { colorVars } from '@astryxdesign/core/theme/tokens.stylex'

import { Wordmark } from '@/components/wordmark'

const styles = stylex.create({
  // Astryx leaves the body transparent, so a standalone page paints its own frame.
  page: {
    minHeight: '100dvh',
    backgroundColor: colorVars['--color-background-body'],
  },
  // An underline running under the mark reads as a mistake on a wordmark lockup.
  brand: {
    textDecoration: 'none',
    opacity: {
      default: 1,
      '@media (hover: hover)': {
        default: 1,
        ':hover': 0.75,
      },
    },
  },
})

interface AuthLayoutProps {
  title: string
  description: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <Center axis="both" padding={6} xstyle={styles.page}>
      <VStack as="main" gap={4} hAlign="center" width="100%" maxWidth={400}>
        <Link href="/" color="primary" xstyle={styles.brand}>
          <Wordmark size="lg" />
        </Link>

        <Card padding={8} width="100%">
          <VStack gap={4} hAlign="stretch">
            <VStack gap={1} hAlign="center">
              <Heading level={1}>{title}</Heading>
              <Text type="body" color="secondary" justify="center">
                {description}
              </Text>
            </VStack>
            {children}
          </VStack>
        </Card>

        {footer ? (
          <Text type="supporting" color="secondary" justify="center">
            {footer}
          </Text>
        ) : null}
      </VStack>
    </Center>
  )
}
