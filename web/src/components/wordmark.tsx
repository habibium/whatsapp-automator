import { BotMessageSquare } from 'lucide-react'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { Text } from '@astryxdesign/core/Text'

export const PRODUCT_NAME = 'WhatsApp Automator'

interface WordmarkProps {
  size?: 'md' | 'lg'
}

export function Wordmark({ size = 'md' }: WordmarkProps) {
  const isLarge = size === 'lg'
  return (
    <HStack as="span" gap={2} vAlign="center">
      <Icon icon={BotMessageSquare} size={size} color="accent" />
      <Text
        weight={isLarge ? 'bold' : 'semibold'}
        size={isLarge ? 'lg' : undefined}
        textWrap="nowrap"
      >
        {PRODUCT_NAME}
      </Text>
    </HStack>
  )
}
