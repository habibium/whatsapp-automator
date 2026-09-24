import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { SiteFrame } from '@/components/site-frame'

const COLUMN_WIDTH = 400

const styles = stylex.create({
  fill: { minHeight: '100%' },
})

interface AuthLayoutProps {
  title: string
  description: ReactNode
  children: ReactNode
  action?: ReactNode
  footer?: ReactNode
}

export function AuthLayout({
  title,
  description,
  children,
  action,
  footer,
}: AuthLayoutProps) {
  return (
    <SiteFrame action={action}>
      <VStack
        hAlign="center"
        paddingBlock={10}
        vAlign="center"
        xstyle={styles.fill}
      >
        <VStack gap={6} maxWidth={COLUMN_WIDTH} width="100%">
          <VStack gap={3}>
            <Heading level={1} type="display-3" textWrap="balance">
              {title}
            </Heading>
            <Text color="secondary">{description}</Text>
          </VStack>

          <Divider />

          {children}

          {footer ? <Text type="supporting">{footer}</Text> : null}
        </VStack>
      </VStack>
    </SiteFrame>
  )
}
