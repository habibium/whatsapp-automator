import * as stylex from '@stylexjs/stylex'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { fontWeightVars } from '@astryxdesign/core/theme/tokens.stylex'

interface SectionIndexProps {
  index: string
  label: string
}

const styles = stylex.create({
  tracked: {
    fontWeight: fontWeightVars['--font-weight-medium'],
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
})

/** The page's spine: every marketing section and auth step is numbered. */
export function SectionIndex({ index, label }: SectionIndexProps) {
  return (
    <HStack as="span" gap={2} vAlign="center">
      <Text type="supporting" color="primary" hasTabularNumbers>
        {index}
      </Text>
      <Text type="supporting" xstyle={styles.tracked}>
        {label}
      </Text>
    </HStack>
  )
}
