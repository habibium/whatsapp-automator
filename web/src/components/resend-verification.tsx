import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'

import { api } from '@/api/client'
import { useCooldown } from '@/lib/use-cooldown'

/** The server sends at most one link a minute per account and ignores the rest silently. */
const COOLDOWN_SECONDS = 60

const OUTCOME_TEXT = {
  sent: 'Sent. It can take a minute to arrive.',
  failed: 'Could not send it. Try again in a moment.',
} as const

interface ResendVerificationProps {
  email: string
}

/** For the moment right after a link went out, so the first wait is already running. */
export function ResendVerification({ email }: ResendVerificationProps) {
  const { remaining, start } = useCooldown(COOLDOWN_SECONDS, true)
  const [outcome, setOutcome] = useState<keyof typeof OUTCOME_TEXT | null>(null)

  const resend = async () => {
    try {
      const { response } = await api.POST('/api/auth/resend-verification', {
        body: { email },
      })
      setOutcome(response.ok ? 'sent' : 'failed')
      if (response.ok) start()
    } catch {
      setOutcome('failed')
    }
  }

  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Button
        label={remaining > 0 ? `Send again in ${remaining}s` : 'Send it again'}
        variant="secondary"
        isDisabled={remaining > 0}
        clickAction={resend}
      />
      {/* Present from the start: a live region only announces changes to itself. */}
      <Text type="supporting" role="status">
        {outcome ? OUTCOME_TEXT[outcome] : ''}
      </Text>
    </HStack>
  )
}
