import * as stylex from '@stylexjs/stylex'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import {
  colorVars,
  radiusVars,
  spacingVars,
} from '@astryxdesign/core/theme/tokens.stylex'

export const PRODUCT_NAME = 'WhatsApp Automator'

interface WordmarkProps {
  size?: 'md' | 'lg'
}

const styles = stylex.create({
  // Astryx has no component for a bare filled shape. Three rounded corners and
  // one square one read as a message bubble without becoming an illustration.
  mark: {
    backgroundColor: colorVars['--color-text-primary'],
    borderEndEndRadius: radiusVars['--radius-inner'],
    borderEndStartRadius: radiusVars['--radius-none'],
    borderStartEndRadius: radiusVars['--radius-inner'],
    borderStartStartRadius: radiusVars['--radius-inner'],
    flexShrink: 0,
  },
  markMd: {
    height: spacingVars['--spacing-3'],
    width: spacingVars['--spacing-3'],
  },
  markLg: {
    height: spacingVars['--spacing-4'],
    width: spacingVars['--spacing-4'],
  },
  name: { letterSpacing: '-0.012em' },
})

export function Wordmark({ size = 'md' }: WordmarkProps) {
  const isLarge = size === 'lg'
  return (
    <HStack as="span" gap={2} vAlign="center">
      <span
        aria-hidden="true"
        {...stylex.props(styles.mark, isLarge ? styles.markLg : styles.markMd)}
      />
      <Text
        weight="semibold"
        size={isLarge ? 'lg' : undefined}
        textWrap="nowrap"
        xstyle={styles.name}
      >
        {PRODUCT_NAME}
      </Text>
    </HStack>
  )
}
