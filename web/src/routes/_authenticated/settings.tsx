import * as stylex from '@stylexjs/stylex'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading, Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { SiteFrame } from '@/components/site-frame'
import { TwoFactorSection } from '@/components/two-factor-section'
import { HOME_HREF } from '@/lib/session'

export const Route = createFileRoute('/_authenticated/settings')({
  component: Settings,
})

const COLUMN_WIDTH = 560

const styles = stylex.create({
  measure: { maxWidth: '45ch' },
})

function Settings() {
  return (
    <SiteFrame
      action={<Button label="Dashboard" variant="ghost" href={HOME_HREF} />}
    >
      <VStack gap={8} maxWidth={COLUMN_WIDTH} paddingBlock={10}>
        <VStack gap={3}>
          <Heading level={1} type="display-3" textWrap="balance">
            Keep your account secure.
          </Heading>
          <Text color="secondary" size="lg" xstyle={styles.measure}>
            Whoever gets into this account can read and send your WhatsApp
            messages, so a password alone shouldn't be enough.
          </Text>
        </VStack>

        <Divider />

        <TwoFactorSection />
      </VStack>
    </SiteFrame>
  )
}
